
-- Fix cloned_voices RLS policies: change from public to authenticated
ALTER POLICY "Users can view own cloned voices" ON public.cloned_voices TO authenticated;
ALTER POLICY "Users can create own cloned voices" ON public.cloned_voices TO authenticated;
ALTER POLICY "Users can delete own cloned voices" ON public.cloned_voices TO authenticated;

-- Create rate_limits table for persistent rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE (identifier)
);

-- Enable RLS but allow edge functions via service role
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Function to check and increment rate limit atomically
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_max_requests integer DEFAULT 10,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Upsert: reset if window expired, otherwise increment
  INSERT INTO public.rate_limits (identifier, window_start, request_count)
  VALUES (p_identifier, now(), 1)
  ON CONFLICT (identifier) DO UPDATE
  SET 
    request_count = CASE
      WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::interval < now()
      THEN 1
      ELSE rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::interval < now()
      THEN now()
      ELSE rate_limits.window_start
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;
