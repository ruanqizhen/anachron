-- ============================
-- Anachron: Post Images Bucket
-- Migration: 017_post_images_bucket
-- ============================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the bucket
-- Allow anyone to view images
CREATE POLICY "Anyone can view post images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'post-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload post images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'post-images' AND 
  auth.role() = 'authenticated'
);

-- Allow users to update their own images
CREATE POLICY "Users can update their own post images" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'post-images' AND 
  auth.uid() = owner
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own post images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'post-images' AND 
  auth.uid() = owner
);
