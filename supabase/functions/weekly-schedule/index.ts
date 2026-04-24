// ─────────────────────────────────────────────────────────────
// BonPlan — Edge Function : weekly-schedule
// Génère automatiquement la sélection de recettes chaque jeudi
// ─────────────────────────────────────────────────────────────
//
// DÉPLOIEMENT :
//   supabase functions deploy weekly-schedule
//
// CRON (Supabase Dashboard → Database → Cron Jobs) :
//   Nom      : generate-weekly-schedule
//   Schedule : 0 10 * * 4        (jeudi à 10:00 UTC = 05:00 EST)
//   Command  : SELECT net.http_post(
//                url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-schedule',
//                headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
//              );
//
// VARIABLES D'ENVIRONNEMENT requises (Settings → Edge Functions) :
//   SUPABASE_URL          (déjà injecté automatiquement)
//   SUPABASE_SERVICE_ROLE_KEY  (à ajouter manuellement)
// ─────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Catégories protéiques et leurs tags correspondants ──────
// On cherche ces mots-clés dans le tableau `tags` ou le `title`
const PROTEIN_GROUPS: Record<string, string[]> = {
  poisson:    ['poisson', 'poissons', 'saumon', 'thon', 'tilapia', 'crevettes', 'fruits de mer', 'morue', 'truite'],
  poulet:     ['poulet', 'volaille', 'dinde', 'chicken'],
  boeuf:      ['boeuf', 'bœuf', 'veau', 'viande', 'steak', 'boulettes', 'burger'],
  porc:       ['porc', 'jambon', 'bacon', 'saucisse', 'côtelette'],
  vegetarien: ['végétarien', 'végétalien', 'vegan', 'tofu', 'légumineuses', 'lentilles', 'pois chiches', 'haricots'],
};

// Cibles de diversité pour une sélection de 8 plats principaux
// Format : { groupe: nb_minimum }
const DIVERSITY_TARGETS = {
  poisson:    1,  // au moins 1 poisson
  poulet:     1,  // au moins 1 poulet
  boeuf:      1,  // au moins 1 boeuf/porc
  vegetarien: 2,  // au moins 2 végé
};

// ── Helpers ─────────────────────────────────────────────────

function getProteinGroup(recipe: { tags: string[]; title: string }): string {
  const haystack = [...(recipe.tags || []), recipe.title].join(' ').toLowerCase();
  for (const [group, keywords] of Object.entries(PROTEIN_GROUPS)) {
    if (keywords.some(k => haystack.includes(k))) return group;
  }
  return 'autre';
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}


// ── Handler principal ────────────────────────────────────────

Deno.serve(async (req) => {
  // Autoriser les appels manuels (GET) et cron (POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Source de vérité partagée avec mobile + web — évite toute divergence de fuseau horaire.
  const { data: weekStart, error: weekErr } = await supabase.rpc('current_week_start');
  if (weekErr || !weekStart) {
    const msg = `current_week_start RPC failed: ${weekErr?.message || 'null'}`;
    console.error(`[weekly-schedule] ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log(`[weekly-schedule] Génération pour la semaine du ${weekStart}`);

  // 1. Vérifier si un schedule existe déjà pour cette semaine
  const { data: existing } = await supabase
    .from('recipe_weekly_schedule')
    .select('recipe_id')
    .eq('week_start', weekStart);

  if (existing && existing.length > 0) {
    const msg = `Schedule déjà existant pour ${weekStart} (${existing.length} recettes). Rien à faire.`;
    console.log(`[weekly-schedule] ${msg}`);
    return new Response(JSON.stringify({ ok: true, message: msg }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Récupérer toutes les recettes publiées (plats principaux seulement)
  const { data: allRecipes, error: recErr } = await supabase
    .from('recipes')
    .select('id, title, tags, category')
    .eq('category', 'main')
    .eq('is_published', true);

  if (recErr || !allRecipes?.length) {
    const msg = `Erreur ou aucune recette publiée : ${recErr?.message}`;
    console.error(`[weekly-schedule] ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Récupérer les recettes des 4 dernières semaines (rotation)
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

  const { data: recentSchedule } = await supabase
    .from('recipe_weekly_schedule')
    .select('recipe_id')
    .gte('week_start', fourWeeksAgoStr);

  const recentIds = new Set((recentSchedule || []).map((r: any) => r.recipe_id));
  console.log(`[weekly-schedule] ${recentIds.size} recettes exclues (rotation 4 semaines)`);

  // 4. Séparer les recettes disponibles (non récentes) et de réserve (récentes)
  const available = allRecipes.filter(r => !recentIds.has(r.id));
  const fallback  = allRecipes.filter(r => recentIds.has(r.id));

  // Si trop peu disponibles, on prend tout
  const pool = available.length >= 4 ? available : allRecipes;

  // 5. Sélection avec diversité
  // Grouper le pool par protéine
  const byGroup: Record<string, typeof pool> = {};
  for (const r of pool) {
    const g = getProteinGroup(r as any);
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(r);
  }

  const selected: typeof pool = [];
  const selectedIds = new Set<string>();

  // Remplir les quotas de diversité en priorité
  for (const [group, minCount] of Object.entries(DIVERSITY_TARGETS)) {
    const candidates = shuffle(byGroup[group] || []).filter(r => !selectedIds.has(r.id));
    let taken = 0;
    for (const r of candidates) {
      if (taken >= minCount) break;
      selected.push(r);
      selectedIds.add(r.id);
      taken++;
    }
    if (taken < minCount) {
      console.warn(`[weekly-schedule] Groupe "${group}" : ${taken}/${minCount} recettes trouvées`);
    }
  }

  // Compléter jusqu'à 8 recettes avec le reste du pool (ordre aléatoire)
  const remaining = shuffle(pool).filter(r => !selectedIds.has(r.id));
  for (const r of remaining) {
    if (selected.length >= 8) break;
    selected.push(r);
    selectedIds.add(r.id);
  }

  // Fallback ultime si on a moins de 8
  if (selected.length < 8) {
    const extra = shuffle(fallback).filter(r => !selectedIds.has(r.id));
    for (const r of extra) {
      if (selected.length >= 8) break;
      selected.push(r);
      selectedIds.add(r.id);
    }
  }

  console.log(`[weekly-schedule] ${selected.length} recettes sélectionnées :`);
  selected.forEach(r => {
    console.log(`  - ${r.title} [${getProteinGroup(r as any)}]`);
  });

  // 6. Insérer dans recipe_weekly_schedule
  const rows = selected.map(r => ({
    recipe_id: r.id,
    week_start: weekStart,
  }));

  const { error: insertErr } = await supabase
    .from('recipe_weekly_schedule')
    .insert(rows);

  if (insertErr) {
    const msg = `Erreur insertion : ${insertErr.message}`;
    console.error(`[weekly-schedule] ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const summary = {
    ok: true,
    week_start: weekStart,
    count: selected.length,
    recipes: selected.map(r => ({
      title: r.title,
      group: getProteinGroup(r as any),
    })),
  };

  console.log(`[weekly-schedule] ✓ Succès`);
  return new Response(JSON.stringify(summary, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});