
CREATE TABLE public.failed_login_attempts (
  email text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- No client access; only service role (edge function) reads/writes.
CREATE OR REPLACE FUNCTION public.check_and_record_login_attempt(
  p_email text,
  p_success boolean,
  p_max_attempts integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900,
  p_lockout_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.failed_login_attempts%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM public.failed_login_attempts WHERE email = p_email;

  -- Currently locked?
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'locked_until', v_row.locked_until,
      'seconds_remaining', EXTRACT(EPOCH FROM (v_row.locked_until - v_now))::int
    );
  END IF;

  IF p_success THEN
    DELETE FROM public.failed_login_attempts WHERE email = p_email;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Failed attempt: insert/increment
  INSERT INTO public.failed_login_attempts (email, attempt_count, first_attempt_at)
  VALUES (p_email, 1, v_now)
  ON CONFLICT (email) DO UPDATE SET
    attempt_count = CASE
      WHEN failed_login_attempts.first_attempt_at + (p_window_seconds || ' seconds')::interval < v_now
        THEN 1
      ELSE failed_login_attempts.attempt_count + 1
    END,
    first_attempt_at = CASE
      WHEN failed_login_attempts.first_attempt_at + (p_window_seconds || ' seconds')::interval < v_now
        THEN v_now
      ELSE failed_login_attempts.first_attempt_at
    END,
    locked_until = CASE
      WHEN (CASE
        WHEN failed_login_attempts.first_attempt_at + (p_window_seconds || ' seconds')::interval < v_now
          THEN 1
        ELSE failed_login_attempts.attempt_count + 1
      END) >= p_max_attempts
      THEN v_now + (p_lockout_seconds || ' seconds')::interval
      ELSE NULL
    END
  RETURNING * INTO v_row;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'locked_until', v_row.locked_until,
      'seconds_remaining', EXTRACT(EPOCH FROM (v_row.locked_until - v_now))::int,
      'just_locked', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_remaining', p_max_attempts - v_row.attempt_count
  );
END;
$$;
