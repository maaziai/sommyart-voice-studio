import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const LYRIA_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const VALID_MODELS = ["lyria-3-clip-preview", "lyria-3-pro-preview"];

interface RequestBody {
  prompt: string;
  model?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: allowed, error: rlError } = await serviceClient.rpc(
      "check_rate_limit",
      {
        p_identifier: `music:${clientIp}`,
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }
    );

    if (rlError || !allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment.", success: false }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const { prompt, model }: RequestBody = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("Prompt is required");
    }
    const sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
    if (sanitized.length > 5000) {
      throw new Error("Prompt exceeds maximum length of 5,000 characters.");
    }

    const selectedModel = model && VALID_MODELS.includes(model) ? model : "lyria-3-clip-preview";

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("Music generation service is not properly configured.");
    }

    console.log(`Generating music with ${selectedModel}, prompt length: ${sanitized.length}`);

    const response = await fetch(LYRIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        model: selectedModel,
        input: sanitized,
        response_format: { type: "audio" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Lyria API error:", response.status, errText);
      if (response.status === 429) {
        const quotaExhausted = /quota|limit: 0/i.test(errText);
        return new Response(
          JSON.stringify({
            success: false,
            error: quotaExhausted
              ? "Music generation quota is exhausted for this API key. Lyria 3 requires a paid Gemini API plan — enable billing on your Google AI Studio key, then try again."
              : "Too many music requests right now. Please wait a moment and try again.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        throw new Error("Prompt was rejected. Try rewording (avoid artist names or copyrighted lyrics).");
      }
      if (response.status === 403 || response.status === 401) {
        throw new Error("Music generation key is invalid or lacks access to Lyria 3.");
      }
      if (response.status >= 500) {
        throw new Error("Music generation service temporarily unavailable.");
      }
      throw new Error("Music generation failed. Please check your prompt and try again.");
    }

    const data = await response.json();

    // Parse the steps schema to extract audio + lyrics
    let audioBase64: string | null = null;
    let mimeType = "audio/mp3";
    const lyrics: string[] = [];

    const steps = data?.steps ?? [];
    for (const step of steps) {
      if (step.type !== "model_output") continue;
      const blocks = step.content ?? [];
      for (const block of blocks) {
        if (block.type === "audio" && block.data) {
          audioBase64 = block.data;
          if (block.mime_type || block.mimeType) mimeType = block.mime_type ?? block.mimeType;
        } else if (block.type === "text" && block.text) {
          lyrics.push(block.text);
        }
      }
    }

    // Fallback to convenience properties if the steps schema shape differs
    if (!audioBase64) {
      const conv = data?.output_audio ?? data?.outputAudio;
      if (conv?.data) {
        audioBase64 = conv.data;
        if (conv.mime_type || conv.mimeType) mimeType = conv.mime_type ?? conv.mimeType;
      }
    }
    if (lyrics.length === 0 && (data?.output_text ?? data?.outputText)) {
      lyrics.push(data.output_text ?? data.outputText);
    }

    if (!audioBase64) {
      console.error("No audio in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("No audio data returned from the service.");
    }


    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics: lyrics.join("\n\n"),
        model: selectedModel,
        message: "Music generated successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-music:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
