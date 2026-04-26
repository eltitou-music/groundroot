ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS coach_state jsonb NOT NULL DEFAULT '{}'::jsonb;