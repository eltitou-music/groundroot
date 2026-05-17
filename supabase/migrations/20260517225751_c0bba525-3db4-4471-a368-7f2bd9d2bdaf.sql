
-- sets
DROP POLICY IF EXISTS sets_delete_own ON public.sets;
DROP POLICY IF EXISTS sets_insert_own ON public.sets;
DROP POLICY IF EXISTS sets_select_own ON public.sets;
DROP POLICY IF EXISTS sets_update_own ON public.sets;
CREATE POLICY sets_select_own ON public.sets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sets_insert_own ON public.sets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY sets_update_own ON public.sets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sets_delete_own ON public.sets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- tracks
DROP POLICY IF EXISTS tracks_delete_own ON public.tracks;
DROP POLICY IF EXISTS tracks_insert_own ON public.tracks;
DROP POLICY IF EXISTS tracks_select_own ON public.tracks;
DROP POLICY IF EXISTS tracks_update_own ON public.tracks;
CREATE POLICY tracks_select_own ON public.tracks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = tracks.set_id AND s.user_id = auth.uid()));
CREATE POLICY tracks_insert_own ON public.tracks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = tracks.set_id AND s.user_id = auth.uid()));
CREATE POLICY tracks_update_own ON public.tracks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = tracks.set_id AND s.user_id = auth.uid()));
CREATE POLICY tracks_delete_own ON public.tracks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = tracks.set_id AND s.user_id = auth.uid()));

-- sound_effects
DROP POLICY IF EXISTS sound_effects_delete_own ON public.sound_effects;
DROP POLICY IF EXISTS sound_effects_insert_own ON public.sound_effects;
DROP POLICY IF EXISTS sound_effects_select_own ON public.sound_effects;
DROP POLICY IF EXISTS sound_effects_update_own ON public.sound_effects;
CREATE POLICY sound_effects_select_own ON public.sound_effects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = sound_effects.set_id AND s.user_id = auth.uid()));
CREATE POLICY sound_effects_insert_own ON public.sound_effects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = sound_effects.set_id AND s.user_id = auth.uid()));
CREATE POLICY sound_effects_update_own ON public.sound_effects FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = sound_effects.set_id AND s.user_id = auth.uid()));
CREATE POLICY sound_effects_delete_own ON public.sound_effects FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = sound_effects.set_id AND s.user_id = auth.uid()));

-- transition_notes
DROP POLICY IF EXISTS transition_notes_delete_own ON public.transition_notes;
DROP POLICY IF EXISTS transition_notes_insert_own ON public.transition_notes;
DROP POLICY IF EXISTS transition_notes_select_own ON public.transition_notes;
DROP POLICY IF EXISTS transition_notes_update_own ON public.transition_notes;
CREATE POLICY transition_notes_select_own ON public.transition_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = transition_notes.set_id AND s.user_id = auth.uid()));
CREATE POLICY transition_notes_insert_own ON public.transition_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = transition_notes.set_id AND s.user_id = auth.uid()));
CREATE POLICY transition_notes_update_own ON public.transition_notes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = transition_notes.set_id AND s.user_id = auth.uid()));
CREATE POLICY transition_notes_delete_own ON public.transition_notes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = transition_notes.set_id AND s.user_id = auth.uid()));

-- set_renders: split owner ALL into authenticated-only, keep public select
DROP POLICY IF EXISTS set_renders_owner_all ON public.set_renders;
CREATE POLICY set_renders_owner_all ON public.set_renders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = set_renders.set_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sets s WHERE s.id = set_renders.set_id AND s.user_id = auth.uid()));

-- storage owner policies → authenticated only
DROP POLICY IF EXISTS "masters owner delete" ON storage.objects;
DROP POLICY IF EXISTS "masters owner update" ON storage.objects;
DROP POLICY IF EXISTS "masters owner write" ON storage.objects;
DROP POLICY IF EXISTS "masters owner read" ON storage.objects;
CREATE POLICY "masters owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'masters' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "masters owner write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'masters' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "masters owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'masters' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "masters owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'masters' AND (auth.uid())::text = (storage.foldername(name))[1]);
