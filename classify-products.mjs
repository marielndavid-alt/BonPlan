import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = 'https://wurvstyckmuktgapqstm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cnZzdHlja211a3RnYXBxc3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODYyMDQsImV4cCI6MjA4NzM2MjIwNH0.wblESinZ62k2l_2t03-C1LYto9gybLEObzc64nQpdZQ';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const CATEGORIES = ['viandes','poissons et fruits de mer','légumes','fruits','produits laitiers','boulangerie','boissons','surgelés','garde-manger','snacks et collations','soins et beauté','produits ménagers','autre'];

async function classifyBatch(products) {
  const productList = products.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Classifie ces produits d'épicerie en français. Réponds UNIQUEMENT en JSON valide, sans markdown.\n\nCatégories disponibles: ${CATEGORIES.join(', ')}\n\nProduits:\n${productList}\n\nRéponds avec ce format exact:\n{"classifications": ["catégorie1", "catégorie2", ...]}` }]
  });
  return JSON.parse(response.content[0].text.trim()).classifications;
}

async function main() {
  const { data: products, error } = await supabase.from('products').select('id, name').is('category', null);
  if (error) { console.error('Erreur:', error); return; }
  console.log(`${products.length} produits à classifier`);
  const BATCH_SIZE = 20;
  let updated = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    console.log(`Traitement ${i + 1} à ${Math.min(i + BATCH_SIZE, products.length)}...`);
    try {
      const categories = await classifyBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const { error: e } = await supabase.from('products').update({ category: categories[j] || 'autre' }).eq('id', batch[j].id);
        if (!e) updated++;
      }
      console.log(`✓ ${updated} produits mis à jour`);
      if (i + BATCH_SIZE < products.length) await new Promise(r => setTimeout(r, 1000));
    } catch (err) { console.error('Erreur:', err); }
  }
  console.log(`✅ Terminé! ${updated}/${products.length} produits classifiés.`);
}

main();
