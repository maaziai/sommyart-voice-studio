-- Lock down SECURITY DEFINER functions: only the roles that actually need EXECUTE keep it.
-- Rate-limit & lockout functions are invoked exclusively from edge functions via service_role.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_record_login_attempt(text, boolean, integer, integer, integer) FROM PUBLIC, anon, authenticated;

-- get_user_roles is server-side only (admin-users edge function via service_role).
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies → authenticated needs EXECUTE, but anon does not.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;