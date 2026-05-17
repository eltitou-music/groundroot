
-- 1. Restrict chat_messages policies to authenticated only
DROP POLICY IF EXISTS chat_messages_select_own ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_delete_own ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_own ON public.chat_messages;

CREATE POLICY chat_messages_select_own ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = chat_messages.set_id AND s.user_id = auth.uid()));

CREATE POLICY chat_messages_delete_own ON public.chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = chat_messages.set_id AND s.user_id = auth.uid()));

CREATE POLICY chat_messages_insert_own ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = chat_messages.set_id AND s.user_id = auth.uid()));

-- 2. Remove broad public SELECT on sets that leaks sensitive columns
DROP POLICY IF EXISTS sets_select_public ON public.sets;

-- Provide a SECURITY DEFINER function exposing only safe columns for public sets
CREATE OR REPLACE FUNCTION public.get_public_set(_set_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  intention text,
  dedicated_to text,
  view_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.intention, s.dedicated_to, s.view_count
  FROM public.sets s
  WHERE s.id = _set_id AND s.is_public = true;
$$;

REVOKE ALL ON FUNCTION public.get_public_set(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_set(uuid) TO anon, authenticated;

-- 3. Lock down SECURITY DEFINER trigger helpers (not meant to be callable via API)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;

-- Keep increment_set_view callable (needed by anonymous share viewers); it only updates public sets.
-- Make sure search_path is set and execution is scoped.
REVOKE ALL ON FUNCTION public.increment_set_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_set_view(uuid) TO anon, authenticated;

-- 4. Make 'masters' bucket private and add scoped read policy
UPDATE storage.buckets SET public = false WHERE id = 'masters';

DROP POLICY IF EXISTS "masters public read" ON storage.objects;

CREATE POLICY "masters owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'masters'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "masters public set read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'masters'
    AND EXISTS (
      SELECT 1
      FROM public.set_renders r
      JOIN public.sets s ON s.id = r.set_id
      WHERE s.is_public = true
        AND r.wav_url LIKE '%/masters/' || storage.objects.name
    )
  );
