-- Bucket public pour stocker les images produits téléchargées depuis les CDN
-- des épiceries (qui bloquent souvent le hotlinking direct).
-- Le scraping télécharge l'image, l'upload ici, puis stocke notre URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB max par image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique (anon + authenticated peuvent voir les images)
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Pas de policy d'écriture: seul service_role (edge functions) peut écrire,
-- et il bypass les RLS de toute façon. Bloquer explicitement l'upload côté anon.
DROP POLICY IF EXISTS "Block anon writes product images" ON storage.objects;
CREATE POLICY "Block anon writes product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id <> 'product-images');
