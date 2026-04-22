import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GETOTP_API = "https://api.otp.dev/v1/verifications";

// Endpoints that may be called pre-authentication (signup verification flow).
// We restrict misuse via a shared bootstrap secret header instead of JWT.
const BOOTSTRAP_HEADER = "x-otp-bootstrap";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require either a valid Supabase JWT OR a valid bootstrap secret.
  // This prevents anonymous abuse of the OTP send/verify endpoints.
  const authHeader = req.headers.get("Authorization");
  const bootstrapHeader = req.headers.get(BOOTSTRAP_HEADER);
  const bootstrapSecret = Deno.env.get("GETOTP_BOOTSTRAP_SECRET");

  let authorized = false;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) authorized = true;
    } catch {
      // fall through to bootstrap check
    }
  }

  if (!authorized && bootstrapSecret && bootstrapHeader === bootstrapSecret) {
    authorized = true;
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("GETOTP_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "GetOTP API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, email, code } = await req.json();

    if (action === "send") {
      if (!email || typeof email !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
            email: email,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("GetOTP send error:", JSON.stringify(data));
        return new Response(
          JSON.stringify({ success: false, error: "Failed to send OTP" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "verify") {
      if (!code || typeof code !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "Verification code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const url = `${GETOTP_API}?code=${encodeURIComponent(code)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-OTP-Key": apiKey,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("GetOTP verify error:", JSON.stringify(data));
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check verification status
      const verification = data?.data?.[0];
      if (verification?.status === "VERIFIED" || verification?.status === "DELIVERED") {
        return new Response(
          JSON.stringify({ success: true, verified: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Code not verified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid action. Use 'send' or 'verify'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("GetOTP error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
