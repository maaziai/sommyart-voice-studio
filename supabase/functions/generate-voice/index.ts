import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map custom voice styles to OpenAI voices
const voiceMap: Record<string, string> = {
  male_calm: "onyx",      // Deep, calm male voice
  female_soft: "nova",    // Soft, clear female voice
  narrator: "alloy",      // Neutral narrator voice
  emotional: "shimmer",   // Expressive, emotional voice
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice_style } = await req.json();
    
    console.log("Generating TTS for text:", text?.substring(0, 50), "with voice:", voice_style);

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Map voice style to OpenAI voice
    const openaiVoice = voiceMap[voice_style] || "alloy";

    console.log("Using OpenAI voice:", openaiVoice);

    // Call OpenAI TTS API
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",  // Use tts-1-hd for higher quality (slower)
        input: text,
        voice: openaiVoice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS error:", response.status, errorText);
      throw new Error(`TTS generation failed: ${response.status}`);
    }

    // Convert audio to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    console.log("TTS generation completed successfully, audio size:", arrayBuffer.byteLength, "bytes");

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/mp3;base64,${base64Audio}`,
        message: "Voice generated successfully!",
        voiceUsed: openaiVoice,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-voice function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
