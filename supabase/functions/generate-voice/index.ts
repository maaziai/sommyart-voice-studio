import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, lang = "en", slow = false } = await req.json();
    
    console.log("Generating gTTS for text:", text?.substring(0, 50), "lang:", lang, "slow:", slow);

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    // Build Google Translate TTS URL (same as gTTS uses)
    const params = new URLSearchParams({
      ie: "UTF-8",
      q: text,
      tl: lang,
      ttsspeed: slow ? "0.24" : "1",
      client: "tw-ob",
      textlen: text.length.toString(),
    });

    const url = `https://translate.google.com/translate_tts?${params.toString()}`;
    
    console.log("Calling Google TTS API");

    // Fetch audio from Google Translate TTS
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error("Google TTS error:", response.status);
      throw new Error(`TTS generation failed: ${response.status}`);
    }

    // Convert audio to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    console.log("TTS generation completed, audio size:", arrayBuffer.byteLength, "bytes");

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/mp3;base64,${base64Audio}`,
        message: "Voice generated successfully!",
        lang,
        slow,
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
