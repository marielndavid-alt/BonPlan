import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FC_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const EXTRACTION_PROMPT = `Extrais tous les produits. Retourne JSON {produits:[{nom_produit,marque,prix_regulier,prix_promo,format_valeur,format_unite,url_produit,image_url}]}. prix_promo seulement si prix barré inférieur.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: Supabase gateway vérifie déjà un JWT valide (anon key min).
  // Le header x-cron-secret reste accepté si fourni et correct (backwards compat),
  // mais n'est plus requis — l'auth gateway suffit.
  const secret = req.headers.get("x-cron-secret");
  if (secret && CRON_SECRET && secret !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "promo"; // "promo" ou "pantry"

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    log(`[${new Date().toISOString()}] Démarrage scraping automatique — mode: ${mode}`);

    // Charger les stores
    const { data: stores } = await supabase.from("stores").select("id,code,name");
    const storeByCode: Record<string, any> = {};
    stores?.forEach((s: any) => { storeByCode[s.code] = s; });

    // Charger les URLs selon le mode
    let urlsQuery = supabase.from("scrape_urls").select("id,url,store_code,description").eq("is_active", true);
    if (mode === "promo") {
      // URLs taguées "promo" dans la description
      urlsQuery = urlsQuery.ilike("description", "%promo%");
    } else if (mode === "pantry") {
      // URLs taguées "garde-manger" dans la description
      urlsQuery = urlsQuery.ilike("description", "%garde-manger%");
    }

    const { data: urls } = await urlsQuery;
    if (!urls?.length) {
      log(`Aucune URL trouvée pour le mode "${mode}"`);
      return new Response(JSON.stringify({ success: true, logs, saved: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`${urls.length} URL(s) à scraper`);
    let totalSaved = 0;

    for (const u of urls) {
      const storeCode = (u.store_code || "").toLowerCase();
      const store = storeByCode[storeCode] || {};
      const storeId = store.id;

      log(`[${storeCode.toUpperCase()}] ${u.url.slice(0, 60)}…`);

      try {
        const isHtml = ["metro", "superc", "maxi"].includes(storeCode);
        const fmt = isHtml ? "html" : storeCode === "walmart" ? "markdown" : "extract";
        const slowStores = ["iga", "walmart", "loblaws"];
        const timeout = slowStores.includes(storeCode) ? 90000 : 60000;

        // Nettoyer l'URL
        const cleanUrl = cleanScrapUrl(u.url);

        const body: any = { url: cleanUrl, formats: [fmt], timeout };
        if (fmt === "extract") body.extract = { prompt: EXTRACTION_PROMPT };
        if (timeout >= 60000) body.waitFor = 3000;

        const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FC_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const fcData = await fcRes.json();
        if (!fcData.success && !fcData.data) throw new Error(fcData.error || "Firecrawl error");
        const d = fcData.data || fcData;

        let produits: any[] = [];
        if (fmt === "html") {
          produits = parseHTML(d.html || "", storeCode, u.url);
        } else if (fmt === "markdown") {
          produits = parseWalmart(d.markdown || "", u.url);
        } else {
          produits = parseLLM(d.extract || d, u.url);
        }

        log(`  → ${produits.length} produits extraits`);

        for (const p of produits) {
          const ok = await saveProduct(supabase, p, storeCode, storeId, u.url);
          if (ok) totalSaved++;
        }

        log(`  ✓ ${totalSaved} sauvegardés`);
      } catch (e: any) {
        log(`  ✗ Erreur: ${e.message}`);
      }

      // Pause entre les URLs
      await new Promise((r) => setTimeout(r, 2000));
    }

    log(`Terminé — ${totalSaved} produits mis à jour`);
    return new Response(JSON.stringify({ success: true, logs, saved: totalSaved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log(`Erreur fatale: ${e.message}`);
    return new Response(JSON.stringify({ success: false, error: e.message, logs }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function cleanScrapUrl(url: string): string {
  try {
    const u = new URL(url);
    ["cartId", "cart_id", "storeId", "store_id", "source", "spQs", "adUid", "bt", "eventST", "wtn", "bkt", "tn"].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}

function parseHTML(html: string, storeCode: string, baseUrl: string): any[] {
  // Parsing basique HTML — retourner vide si pas de parser côté serveur
  // Le vrai parsing se fait côté client avec DOMParser
  // Ici on utilise regex simples
  const produits: any[] = [];
  // Maxi/Metro: chercher les prix et noms via regex
  const priceMatches = html.matchAll(/data-testid="product-title"[^>]*>([^<]+)<\/[^>]+>[\s\S]*?data-testid="regular-price"[^>]*>([\d.,]+)/g);
  for (const m of priceMatches) {
    produits.push({ nom: m[1].trim(), marque: "", prixReg: m[2], prixPromo: "", fmtVal: "", fmtUnite: "", urlProd: baseUrl, imgUrl: "" });
  }
  return produits;
}

function parseWalmart(md: string, baseUrl: string): any[] {
  const produits: any[] = [];
  const blocs = md.split(/\n(?=\[)/);
  for (const bloc of blocs) {
    const ml = bloc.match(/\[([^\]]+)\]\((https:\/\/www\.walmart\.ca\/[^)]+)\)/);
    if (!ml) continue;
    const mp = bloc.match(/prix actuel\s+([\d,.]+)\s*(\$|¢)/) || bloc.match(/([\d,.]+)\s*(\$|¢)/);
    if (!mp) continue;
    let pf = parseFloat(mp[1].replace(",", ".")); if (mp[2] === "¢") pf = +(pf / 100).toFixed(2);
    const mfmt = (ml[1] + " " + bloc).match(/([\d.,]+)\s*(kg|ml|oz|lb|g|l)(?=[\s,./]|$)/i);
    produits.push({ nom: ml[1], marque: "", prixReg: String(pf), prixPromo: "", fmtVal: mfmt?.[1] || "", fmtUnite: mfmt?.[2]?.toLowerCase() || "", urlProd: ml[2], imgUrl: "" });
  }
  return produits;
}

function parseLLM(extract: any, url: string): any[] {
  const raw = (extract && (extract.produits || extract.products)) || [];
  const VALID_UNITS = new Set(["g", "kg", "mg", "oz", "lb", "ml", "l", "cl"]);
  return raw.map((p: any) => {
    let fv = String(p.format_valeur || p.format_value || p.format || "");
    let fu = String(p.format_unite || p.format_unit || "").replace(/[0-9$.€,\s/]+/g, "").toLowerCase().trim();
    const mf = (fv + " " + fu).trim().match(/^([\d.,]+)\s*(g|kg|mg|ml|l|cl|oz|lb)\b/i);
    if (mf) { fv = mf[1]; fu = mf[2].toLowerCase(); }
    if (fu && !VALID_UNITS.has(fu)) fu = "";
    let prixReg = String(p.prix_regulier || p.regular_price || p.price || "");
    let prixPromo = String(p.prix_promo || p.promo_price || "");
    if (!prixPromo || prixPromo === "null" || prixPromo === "0") prixPromo = "";
    return { nom: p.nom_produit || p.name || "", marque: p.marque || p.brand || "", prixReg, prixPromo, fmtVal: fv, fmtUnite: fu, urlProd: p.url_produit || p.product_url || url, imgUrl: p.image_url || p.image || "" };
  }).filter((p: any) => p.nom && p.prixReg);
}

async function saveProduct(supabase: any, produit: any, storeCode: string, storeId: string, scrapeUrl: string): Promise<boolean> {
  const nom = (produit.nom || "").trim();
  const prixReg = parseFloat(String(produit.prixReg).replace(",", "."));
  if (!nom || !prixReg || !storeId) return false;

  const prixPromo = produit.prixPromo ? parseFloat(String(produit.prixPromo).replace(",", ".")) : null;
  const now = new Date().toISOString();

  // Chercher le produit
  const { data: found } = await supabase.from("products").select("id").eq("name", nom).limit(1);
  let productId = found?.[0]?.id;

  if (!productId) {
    const { data: created } = await supabase.from("products").insert({ name: nom, brand: produit.marque || null, unit: produit.fmtUnite || "unité" }).select("id").single();
    productId = created?.id;
  }

  if (!productId) return false;

  // Calculer parsed_quantity en base
  const TO_G: Record<string, number> = { g:1, kg:1000, mg:0.001, oz:28.3495, lb:453.592 };
  const TO_ML: Record<string, number> = { ml:1, l:1000, cl:10 };
  const rawVal = produit.fmtVal ? parseFloat(produit.fmtVal) : null;
  const rawUnit = (produit.fmtUnite || "").toLowerCase();
  let parsedQtyBase: number | null = null;
  if (rawVal && rawUnit) {
    if (TO_G[rawUnit]) parsedQtyBase = rawVal * TO_G[rawUnit];
    else if (TO_ML[rawUnit]) parsedQtyBase = rawVal * TO_ML[rawUnit];
    else parsedQtyBase = rawVal;
  }

  const qtyFilter = parsedQtyBase ? { parsed_quantity: parsedQtyBase } : {};
  const { data: existing } = await supabase.from("prices").select("id")
    .eq("product_id", productId).eq("store_id", storeId)
    .eq(parsedQtyBase ? "parsed_quantity" : "store_id", parsedQtyBase || storeId)
    .limit(1);

  const isOnSale = !!(prixPromo && prixPromo < prixReg);
  if (existing?.[0]?.id) {
    await supabase.from("prices").update({ regular_price: prixReg, sale_price: isOnSale ? prixPromo : null, is_on_sale: isOnSale, last_updated: now, ...(produit.imgUrl ? { image_url: produit.imgUrl } : {}) }).eq("id", existing[0].id);
  } else {
    const norm = prixReg && rawVal && rawUnit ? (TO_G[rawUnit] ? { val: prixReg / (rawVal * TO_G[rawUnit]), type: "g" } : TO_ML[rawUnit] ? { val: prixReg / (rawVal * TO_ML[rawUnit]), type: "ml" } : null) : null;
    await supabase.from("prices").insert({ product_id: productId, store_id: storeId, regular_price: prixReg, sale_price: isOnSale ? prixPromo : null, is_on_sale: isOnSale, parsed_quantity: parsedQtyBase, quantity: produit.fmtVal && produit.fmtUnite ? `${produit.fmtVal} ${produit.fmtUnite}` : null, unit_price: norm?.val || null, unit_type: norm?.type || rawUnit || null, scrape_url: produit.urlProd || scrapeUrl, image_url: produit.imgUrl || null, last_updated: now });
  }

  return true;
}