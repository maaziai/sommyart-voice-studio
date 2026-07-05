import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GETOTP_API = "https://api.otp.dev/v1/verifications";

// Server-side PIN padding - not visible in client bundle
const padPin = (pin: string): string => `SA${pin}`;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

const sendOtp = async (email: string) => {
  const apiKey = Deno.env.get("GETOTP_API_KEY");
  if (!apiKey) throw new Error("Verification service is not configured.");

  const response = await fetch(GETOTP_API, {
    method: "POST",
    headers: {
      "X-OTP-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        channel: "email",
        email,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("GetOTP send error:", errorBody);
    throw new Error("Unable to send verification code. Please try again.");
  }
};

const verifyOtp = async (code: string) => {
  const apiKey = Deno.env.get("GETOTP_API_KEY");
  if (!apiKey) throw new Error("Verification service is not configured.");

  const response = await fetch(`${GETOTP_API}?code=${encodeURIComponent(code)}`, {
    method: "GET",
    headers: {
      "X-OTP-Key": apiKey,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("GetOTP verify error:", JSON.stringify(data));
    return false;
  }

  const verification = data?.data?.[0];
  return verification?.status === "VERIFIED" || verification?.status === "DELIVERED";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, pin, code } = await req.json();

    if (!action || typeof action !== "string") {
      throw new Error("Action is required.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (action === "signup") {
      if (!email || !pin) throw new Error("Email and PIN are required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");

      await sendOtp(normalizeEmail(email));

      return jsonResponse({
        success: true,
        needsVerification: true,
      });

    } else if (action === "verify_signup") {
      if (!email || !pin || !code) throw new Error("Email, PIN, and verification code are required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");
      if (!/^\d{6}$/.test(code)) throw new Error("Verification code must be exactly 6 digits.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");

      const normalizedEmail = normalizeEmail(email);
      const verified = await verifyOtp(code);
      if (!verified) {
        return jsonResponse({ success: false, error: "Invalid or expired code." }, 400);
      }

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const createResult = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: padPin(pin),
        email_confirm: true,
      });

      if (createResult.error) {
        const message = createResult.error.message.toLowerCase();
        if (!message.includes("already") && !message.includes("registered") && !message.includes("exists")) {
          return jsonResponse({ success: false, error: createResult.error.message }, 400);
        }

        const { data: listedUsers, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) {
          return jsonResponse({ success: false, error: "Unable to update existing account." }, 400);
        }

        const existingUser = listedUsers.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
        if (!existingUser) {
          return jsonResponse({ success: false, error: "Account already exists. Please sign in." }, 400);
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: padPin(pin),
          email_confirm: true,
        } as any);

        if (updateError) {
          return jsonResponse({ success: false, error: "Unable to update existing account." }, 400);
        }
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: padPin(pin),
      });

      if (error) {
        return jsonResponse({ success: false, error: error.message }, 400);
      }

      return jsonResponse({ success: true, session: data.session });

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
        if (error.message.toLowerCase().includes("email not confirmed")) {
          await sendOtp(normalizedEmail);
          return jsonResponse({ success: false, error: "Email not confirmed", needsVerification: true }, 403);
        }

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
        return jsonResponse({ success: false, error: userMessage }, 401);
      }

      // Success: clear failed attempts
      await adminClient.rpc("check_and_record_login_attempt", {
        p_email: normalizedEmail,
        p_success: true,
      });

      return jsonResponse({ success: true, session: data.session });

    } else if (action === "update_password") {
      if (!pin) throw new Error("PIN is required.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, error: "Unauthorized" }, 401);
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { error } = await supabase.auth.updateUser({
        password: padPin(pin),
      });

      if (error) {
        return jsonResponse({ success: false, error: error.message }, 400);
      }

      return jsonResponse({ success: true });

    } else {
      throw new Error("Invalid action.");
    }
  } catch (error) {
    console.error("auth-pin error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
    }, 400);
  }
});
