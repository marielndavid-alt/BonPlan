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

const STORE_REFERER: Record<string, string> = {
  metro: "https://www.metro.ca/",
  superc: "https://www.superc.ca/",
  maxi: "https://www.maxi.ca/",
  loblaws: "https://www.loblaws.ca/",
  iga: "https://www.iga.net/",
  walmart: "https://www.walmart.ca/",
  avril: "https://www.avril.ca/",
  rachelle: "https://www.rachellebery.com/",
};

const STORAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/product-images/`;

// Télécharge une image depuis le CDN d'épicerie et la met dans Supabase Storage.
// Retourne l'URL publique de notre bucket, ou l'URL d'origine si échec.
async function rehostImage(supabase: any, originalUrl: string, storeCode: string, productId: string): Promise<string> {
  if (!originalUrl) return originalUrl;
  // Déjà dans notre bucket → ne rien refaire
  if (originalUrl.startsWith(STORAGE_PUBLIC_PREFIX)) return originalUrl;

  try {
    const referer = STORE_REFERER[storeCode] || "";
    const res = await fetch(originalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!res.ok) return originalUrl;
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return originalUrl;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return originalUrl;

    let ext = ct.split("/")[1].split(";")[0].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    if (!["jpg", "png", "webp", "avif"].includes(ext)) ext = "jpg";

    const path = `${storeCode}/${productId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(path, buf, { contentType: ct, upsert: true });
    if (upErr) return originalUrl;

    return STORAGE_PUBLIC_PREFIX + path;
  } catch {
    return originalUrl;
  }
}

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
  const mode = url.searchParams.get("mode") || "promo"; // "promo" | "pantry" | "backfill_images"

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  // === Mode backfill: re-héberge les images CDN existantes dans Supabase Storage ===
  if (mode === "backfill_images") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    log(`[backfill_images] Traitement de ${limit} produits…`);

    const { data: rows, error } = await supabase
      .from("prices")
      .select("id, image_url, product_id, stores(code), products(image_url)")
      .eq("is_on_sale", true)
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0, updated = 0, skipped = 0;
    for (const row of rows || []) {
      const cdnUrl = (row as any).image_url || ((row as any).products?.image_url);
      if (!cdnUrl) { skipped++; continue; }
      if (cdnUrl.startsWith(STORAGE_PUBLIC_PREFIX)) { skipped++; continue; }
      const storeCode = ((row as any).stores?.code) || "unknown";
      const newUrl = await rehostImage(supabase, cdnUrl, storeCode, (row as any).product_id);
      if (newUrl !== cdnUrl) {
        await supabase.from("prices").update({ image_url: newUrl }).eq("id", (row as any).id);
        updated++;
      }
      processed++;
    }
    log(`Terminé: ${processed} traités, ${updated} mis à jour, ${skipped} ignorés`);
    return new Response(JSON.stringify({ success: true, logs, processed, updated, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
  const produits: any[] = [];
  const titleRe = /data-testid="product-title"[^>]*>([^<]+)<\/[^>]+>[\s\S]*?data-testid="regular-price"[^>]*>([\d.,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = titleRe.exec(html)) !== null) {
    // Cherche un <img src=…> dans la fenêtre 2000 chars avant le titre
    // (l'image apparaît avant le bloc texte dans la plupart des templates Metro/Maxi/Super C)
    const wStart = Math.max(0, m.index - 2000);
    const wEnd = Math.min(html.length, m.index + 200);
    const window = html.slice(wStart, wEnd);
    const imgMatch = window.match(/<img[^>]+(?:data-src|data-original|src)=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/i);
    let img = imgMatch?.[1] || "";
    if (img && img.startsWith("//")) img = "https:" + img;
    if (img && img.startsWith("/")) {
      try { img = new URL(img, baseUrl).toString(); } catch { /* keep as-is */ }
    }
    produits.push({ nom: m[1].trim(), marque: "", prixReg: m[2], prixPromo: "", fmtVal: "", fmtUnite: "", urlProd: baseUrl, imgUrl: img });
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
    // Image: syntaxe markdown ![alt](url) ou <img src="…"> en fallback
    const mi =
      bloc.match(/!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpe?g|png|webp|avif)[^)]*)\)/i) ||
      bloc.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/i);
    const img = mi?.[1] || "";
    let pf = parseFloat(mp[1].replace(",", ".")); if (mp[2] === "¢") pf = +(pf / 100).toFixed(2);
    const mfmt = (ml[1] + " " + bloc).match(/([\d.,]+)\s*(kg|ml|oz|lb|g|l)(?=[\s,./]|$)/i);
    produits.push({ nom: ml[1], marque: "", prixReg: String(pf), prixPromo: "", fmtVal: mfmt?.[1] || "", fmtUnite: mfmt?.[2]?.toLowerCase() || "", urlProd: ml[2], imgUrl: img });
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

  // Re-héberge l'image dans notre Storage avant de la sauvegarder
  // (les CDN d'épiceries bloquent souvent le hotlinking direct)
  const finalImg = produit.imgUrl
    ? await rehostImage(supabase, produit.imgUrl, storeCode, productId)
    : null;

  if (existing?.[0]?.id) {
    await supabase.from("prices").update({ regular_price: prixReg, sale_price: isOnSale ? prixPromo : null, is_on_sale: isOnSale, last_updated: now, ...(finalImg ? { image_url: finalImg } : {}) }).eq("id", existing[0].id);
  } else {
    const norm = prixReg && rawVal && rawUnit ? (TO_G[rawUnit] ? { val: prixReg / (rawVal * TO_G[rawUnit]), type: "g" } : TO_ML[rawUnit] ? { val: prixReg / (rawVal * TO_ML[rawUnit]), type: "ml" } : null) : null;
    await supabase.from("prices").insert({ product_id: productId, store_id: storeId, regular_price: prixReg, sale_price: isOnSale ? prixPromo : null, is_on_sale: isOnSale, parsed_quantity: parsedQtyBase, quantity: produit.fmtVal && produit.fmtUnite ? `${produit.fmtVal} ${produit.fmtUnite}` : null, unit_price: norm?.val || null, unit_type: norm?.type || rawUnit || null, scrape_url: produit.urlProd || scrapeUrl, image_url: finalImg, last_updated: now });
  }

  return true;
}