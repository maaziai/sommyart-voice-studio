import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: claimsData.claims.sub as string };

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("Voice cloning service not configured.");

    const formData = await req.formData();
    const action = formData.get("action") as string;

    if (action === "clone") {
      const name = formData.get("name") as string;
      const audioFile = formData.get("audio") as File;

      if (!name || name.length < 1 || name.length > 50) {
        throw new Error("Voice name must be 1-50 characters.");
      }
      if (!audioFile) throw new Error("Audio file is required.");
      if (audioFile.size > 10 * 1024 * 1024) {
        throw new Error("Audio file must be under 10MB.");
      }

      // Check user's cloned voice count (limit to 10)
      const { count } = await supabase
        .from("cloned_voices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count ?? 0) >= 10) {
        throw new Error("Maximum of 10 cloned voices reached. Delete one to add more.");
      }

      // Call ElevenLabs Add Voice API
      const elFormData = new FormData();
      elFormData.append("name", `${name}_${user.id.slice(0, 8)}`);
      elFormData.append("files", audioFile);
      elFormData.append("description", `Cloned voice for user ${user.id}`);

      const elResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
        body: elFormData,
      });

      if (!elResponse.ok) {
        const errText = await elResponse.text();
        console.error("ElevenLabs clone error:", elResponse.status, errText);
        throw new Error("Voice cloning failed. Ensure audio is clear speech (min 30 seconds recommended).");
      }

      const { voice_id } = await elResponse.json();

      // Save to database
      const { error: dbError } = await supabase
        .from("cloned_voices")
        .insert({ user_id: user.id, name, elevenlabs_voice_id: voice_id });

      if (dbError) {
        console.error("DB error:", dbError);
        throw new Error("Failed to save cloned voice.");
      }

      return new Response(JSON.stringify({ success: true, voice_id, name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "delete") {
      const voiceId = formData.get("voice_id") as string;
      if (!voiceId) throw new Error("Voice ID required.");

      // Get the ElevenLabs voice ID before deleting
      const { data: voice } = await supabase
        .from("cloned_voices")
        .select("elevenlabs_voice_id")
        .eq("id", voiceId)
        .eq("user_id", user.id)
        .single();

      if (voice?.elevenlabs_voice_id) {
        // Delete from ElevenLabs
        await fetch(`https://api.elevenlabs.io/v1/voices/${voice.elevenlabs_voice_id}`, {
          method: "DELETE",
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });
      }

      // Delete from DB
      await supabase.from("cloned_voices").delete().eq("id", voiceId).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "list") {
      const { data: voices } = await supabase
        .from("cloned_voices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ success: true, voices: voices || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid action.");
    }
  } catch (error) {
    console.error("clone-voice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred.", success: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
