-- Iteration 03: Dedication, public sharing, journal feedback loop

-- 1. Extend `sets` with dedication, share-publicness, and a personal journal note.
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS dedicated_to TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- 2. Allow anonymous SELECT on sets that are explicitly public (in addition to owner SELECT)
DROP POLICY IF EXISTS sets_select_public ON public.sets;
CREATE POLICY sets_select_public
  ON public.sets
  FOR SELECT
  USING (is_public = TRUE);

-- 3. Allow anonymous SELECT on tracks that belong to public sets
DROP POLICY IF EXISTS tracks_select_public ON public.tracks;
CREATE POLICY tracks_select_public
  ON public.tracks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sets s
      WHERE s.id = tracks.set_id AND s.is_public = TRUE
    )
  );

-- 4. set_renders table — one row per published master
CREATE TABLE IF NOT EXISTS public.set_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL,
  wav_url TEXT NOT NULL,
  rendered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.set_renders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS set_renders_owner_all ON public.set_renders;
CREATE POLICY set_renders_owner_all
  ON public.set_renders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.sets s WHERE s.id = set_renders.set_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sets s WHERE s.id = set_renders.set_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS set_renders_select_public ON public.set_renders;
CREATE POLICY set_renders_select_public
  ON public.set_renders
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.sets s WHERE s.id = set_renders.set_id AND s.is_public = TRUE)
  );

-- 5. Public RPC to bump view count without exposing UPDATE rights
CREATE OR REPLACE FUNCTION public.increment_set_view(_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sets
  SET view_count = view_count + 1
  WHERE id = _set_id AND is_public = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_set_view(UUID) TO anon, authenticated;

-- 6. Storage bucket for mastered renders, public-read
INSERT INTO storage.buckets (id, name, public)
VALUES ('masters', 'masters', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "masters public read" ON storage.objects;
CREATE POLICY "masters public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'masters');

DROP POLICY IF EXISTS "masters owner write" ON storage.objects;
CREATE POLICY "masters owner write"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'masters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "masters owner update" ON storage.objects;
CREATE POLICY "masters owner update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'masters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "masters owner delete" ON storage.objects;
CREATE POLICY "masters owner delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'masters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
