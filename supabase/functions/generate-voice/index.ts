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
    const { text } = await req.json();
    
    console.log("Generating Bytez Suno Bark audio for text:", text?.substring(0, 50));

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    const BYTEZ_API_KEY = Deno.env.get("BYTEZ_API_KEY");
    if (!BYTEZ_API_KEY) {
      throw new Error("BYTEZ_API_KEY is not configured");
    }

    console.log("Calling Bytez Suno Bark API");

    // Call Bytez API
    const response = await fetch("https://api.bytez.com/models/v2/suno/bark-small", {
      method: "POST",
      headers: {
        "Authorization": BYTEZ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bytez API error:", response.status, errorText);
      throw new Error(`TTS generation failed: ${response.status} - ${errorText}`);
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
        audioUrl: `data:audio/wav;base64,${base64Audio}`,
        message: "Voice generated successfully!",
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
