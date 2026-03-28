import { supabase } from '@/lib/supabase';
export interface IngredientConversion { id: string; product_id: string; from_unit: string; to_unit: string; factor: number; }
export const calculatePrice = (price: number, quantity: number, factor: number) => price * quantity * factor;
export const getConversions = async (productId: string): Promise<IngredientConversion[]> => {
  const { data } = await supabase.from('ingredient_conversions').select('*').eq('product_id', productId);
  return data || [];
};
export const addConversion = async (productId: string, conversion: Partial<IngredientConversion>) => {
  await supabase.from('ingredient_conversions').insert({ product_id: productId, ...conversion });
};
export const removeConversion = async (id: string) => {
  await supabase.from('ingredient_conversions').delete().eq('id', id);
};
