
-- Public buckets are accessible via public URLs without a SELECT policy.
-- Removing the broad SELECT policy prevents listing all files while keeping public read by URL.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
