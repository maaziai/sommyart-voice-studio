
DROP TABLE IF EXISTS public.generations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.failed_login_attempts CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_and_record_login_attempt(text, boolean, integer, integer, integer) CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DELETE FROM auth.users;
