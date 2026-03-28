import { supabase } from '@/lib/supabase';

const TO_G: Record<string, number>  = { g:1, kg:1000, mg:0.001, oz:28.3495, lb:453.592 };
const TO_ML: Record<string, number> = { ml:1, l:1000, cl:10, 'c. à thé':4.93, 'c. à soupe':14.79, tasse:236.6 };

function extractUnit(unitType: string): string {
  if (!unitType) return '';
  const u = unitType.toLowerCase().trim();
  if (u.includes('g') || u.includes('kg')) return 'g';
  if (u.includes('ml') || u.includes('l')) return 'ml';
  return u;
}

function convertToBase(qty: number, unit: string): { val: number; base: string } | null {
  const u = (unit || '').toLowerCase().trim();
  if (TO_G[u])  return { val: qty * TO_G[u],  base: 'g' };
  if (TO_ML[u]) return { val: qty * TO_ML[u], base: 'ml' };
  return null;
}

export interface StoreCost {
  storeCode: string;
  storeName: string;
  storeColor: string;
  total: number;
  covered: number;
  totalIngredients: number;
}

export const recipePriceService = {

  async calculateRecipePrices(recipeId: string): Promise<StoreCost[]> {
    // 1. Charger les ingrédients
    const { data: ings } = await supabase
      .from('recipe_ingredients')
      .select('id, product_id, quantity, unit, products!left(name, unit)')
      .eq('recipe_id', recipeId);

    if (!ings || ings.length === 0) return [];

    // 2. Charger les conversions
    const prodIds = [...new Set(ings.map((i: any) => i.product_id).filter(Boolean))];
    const { data: convRows } = await supabase
      .from('ingredient_conversions')
      .select('ingredient_id, from_unit, to_base_unit_factor')
      .in('ingredient_id', prodIds);

    const convMap: Record<string, Record<string, number>> = {};
    for (const c of (convRows || [])) {
      if (!convMap[c.ingredient_id]) convMap[c.ingredient_id] = {};
      convMap[c.ingredient_id][(c.from_unit || '').toLowerCase()] = parseFloat(c.to_base_unit_factor);
    }

    // 3. Charger les stores
    const { data: stores } = await supabase
      .from('stores')
      .select('id, code, name, color');

    if (!stores) return [];

    // 4. Pour chaque ingrédient, charger les prix
    const priceMap: Record<string, Record<string, any>> = {};

    for (const ing of ings) {
      const ingName = (ing as any).products?.name || '';
      if (!ingName || !ing.product_id) continue;

      const { data: matchingProds } = await supabase
        .from('products')
        .select('id')
        .ilike('name', `%${ingName.replace(/œ/g, 'oe')}%`)
        .limit(30);

      if (!matchingProds || matchingProds.length === 0) continue;

      const matchIds = matchingProds.map((p: any) => p.id);

      const { data: matchPrices } = await supabase
        .from('prices')
        .select('product_id, store_id, regular_price, sale_price, is_on_sale, parsed_quantity, unit_type, unit_price')
        .in('product_id', matchIds);

      for (const p of (matchPrices || [])) {
        const rawEff = (p.is_on_sale && p.sale_price && parseFloat(p.sale_price) > 0)
          ? parseFloat(p.sale_price)
          : parseFloat(p.regular_price);
        const eff = rawEff || 0;
        if (!eff) continue;

        if (!priceMap[ing.product_id]) priceMap[ing.product_id] = {};
        const existing = priceMap[ing.product_id][p.store_id];
        if (!existing || eff < existing.eff) {
          priceMap[ing.product_id][p.store_id] = {
            eff,
            unit_price: p.unit_price ? parseFloat(p.unit_price) : null,
            parsed_quantity: p.parsed_quantity ? parseFloat(p.parsed_quantity) : null,
            unit_type: p.unit_type || null,
          };
        }
      }
    }

    // 5. Calculer le coût par store
    const storeTotals: Record<string, number> = {};
    const storeCovered: Record<string, number> = {};

    for (const ing of ings) {
      const qty = parseFloat((ing as any).quantity) || 1;
      const ingUnit = ((ing as any).unit || '').toLowerCase();
      const storePrice = priceMap[(ing as any).product_id] || {};

      for (const store of stores) {
        const p = storePrice[store.id];
        if (!p) continue;

        let cost: number;

        if (p.unit_price && p.unit_type && qty > 0) {
          const priceBase = extractUnit(p.unit_type);
          const ingConverted = convertToBase(qty, ingUnit);
          const customFactor = (convMap[(ing as any).product_id] || {})[ingUnit];

          if (customFactor && (priceBase === 'g' || priceBase === 'ml')) {
            cost = p.unit_price * (qty * customFactor);
          } else if (ingConverted && ingConverted.base === priceBase) {
            cost = p.unit_price * ingConverted.val;
          } else {
            cost = p.eff;
          }
        } else if (p.parsed_quantity && p.parsed_quantity > 0 && qty > 0) {
          cost = (p.eff / p.parsed_quantity) * qty;
        } else {
          cost = p.eff;
        }

        storeTotals[store.id] = (storeTotals[store.id] || 0) + cost;
        storeCovered[store.id] = (storeCovered[store.id] || 0) + 1;
      }
    }

    // 6. Retourner les résultats triés par total
    return stores
      .filter(s => storeCovered[s.id] > 0)
      .map(s => ({
        storeCode: s.code,
        storeName: s.name,
        storeColor: s.color,
        total: storeTotals[s.id] || 0,
        covered: storeCovered[s.id] || 0,
        totalIngredients: ings.length,
      }))
      .sort((a, b) => a.total - b.total);
  },

  async getBestPrice(recipeId: string): Promise<{ storeCode: string; total: number } | null> {
    const results = await this.calculateRecipePrices(recipeId);
    if (results.length === 0) return null;
    const best = results[0];
    return { storeCode: best.storeCode, total: best.total };
  },
};
