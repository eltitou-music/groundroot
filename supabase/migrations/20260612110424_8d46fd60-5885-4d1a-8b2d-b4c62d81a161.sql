
-- Storage RLS for track-uploads bucket: scope to user folder (first path segment = uid)
CREATE POLICY "track_uploads_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'track-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "track_uploads_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'track-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "track_uploads_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'track-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "track_uploads_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'track-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Telemetry events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  set_id uuid,
  name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_insert_own"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_select_own"
ON public.events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX events_user_created_idx ON public.events (user_id, created_at DESC);
