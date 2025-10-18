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
    const { text, voice_style } = await req.json();
    
    console.log("Generating voice for text:", text?.substring(0, 50), "with voice:", voice_style);

    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI to generate a realistic voice description
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional voice director. Generate a realistic voice performance description based on the text and voice style. The description should capture emotion, pacing, and tone.`,
          },
          {
            role: "user",
            content: `Voice Style: ${voice_style || 'narrator'}\n\nText to perform: ${text}\n\nProvide a brief, professional description of how this would sound when performed by a voice actor.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiData = await response.json();
    const voiceDescription = aiData.choices?.[0]?.message?.content || "Voice generated successfully";

    console.log("Voice generation completed successfully");

    // Return a simulated audio response
    // In production, this would call a real TTS API like Fal.ai
    return new Response(
      JSON.stringify({
        success: true,
        voiceDescription,
        audioUrl: `data:audio/mp3;base64,${btoa("simulated-audio-data")}`,
        message: "Voice generated successfully! (Note: This is a demo using AI-powered voice descriptions. Connect a real TTS API for actual audio generation.)",
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
