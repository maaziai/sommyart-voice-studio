import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side PIN padding - not visible in client bundle
const padPin = (pin: string): string => `SA${pin}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, pin, token } = await req.json();

    if (!action || typeof action !== "string") {
      throw new Error("Action is required.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (action === "signup") {
      if (!email || !pin) throw new Error("Email and PIN are required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: padPin(pin),
        options: {
          emailRedirectTo: req.headers.get("origin") || undefined,
        },
      });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          needsVerification: data.user && !data.session,
          session: data.session,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "signin") {
      if (!email || !pin) throw new Error("Email and PIN are required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const normalizedEmail = email.toLowerCase().trim();

      // Pre-check lock status (peek without mutating)
      const { data: lockRow } = await adminClient
        .from("failed_login_attempts")
        .select("locked_until")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (lockRow?.locked_until && new Date(lockRow.locked_until) > new Date()) {
        const secondsRemaining = Math.ceil(
          (new Date(lockRow.locked_until).getTime() - Date.now()) / 1000
        );
        const minutes = Math.ceil(secondsRemaining / 60);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            locked: true,
            seconds_remaining: secondsRemaining,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: padPin(pin),
      });

      if (error) {
        const { data: result } = await adminClient.rpc("check_and_record_login_attempt", {
          p_email: normalizedEmail,
          p_success: false,
        });
        let userMessage = "Invalid email or PIN.";
        if (result && (result as any).just_locked) {
          userMessage = "Too many failed attempts. Account locked for 15 minutes.";
        } else if (result && typeof (result as any).attempts_remaining === "number") {
          userMessage = `Invalid email or PIN. ${(result as any).attempts_remaining} attempt(s) remaining.`;
        }
        return new Response(
          JSON.stringify({ success: false, error: userMessage }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success: clear failed attempts
      await adminClient.rpc("check_and_record_login_attempt", {
        p_email: normalizedEmail,
        p_success: true,
      });

      return new Response(
        JSON.stringify({ success: true, session: data.session }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "update_password") {
      if (!pin) throw new Error("PIN is required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { error } = await supabase.auth.updateUser({
        password: padPin(pin),
      });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      throw new Error("Invalid action.");
    }
  } catch (error) {
    console.error("auth-pin error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
