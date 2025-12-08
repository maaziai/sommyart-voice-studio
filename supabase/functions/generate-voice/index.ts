import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Speaker {
  name: string;
  voice: string;
}

interface RequestBody {
  text: string;
  isMultiSpeaker?: boolean;
  speakers?: Speaker[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, isMultiSpeaker, speakers }: RequestBody = await req.json();
    
    console.log("Generating Google Gemini TTS audio for text:", text?.substring(0, 50));
    console.log("Multi-speaker mode:", isMultiSpeaker, "Speakers:", speakers?.length);

    // Server-side input validation
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    if (text.length > 3000) {
      throw new Error("Text exceeds maximum length of 3000 characters");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    console.log("Calling Google Gemini 2.5 Flash TTS API");

    // Build speech config based on mode
    let speechConfig: Record<string, unknown>;
    
    if (isMultiSpeaker && speakers && speakers.length >= 2) {
      // Multi-speaker configuration
      speechConfig = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map(speaker => ({
            speaker: speaker.name,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: speaker.voice
              }
            }
          }))
        }
      };
    } else {
      // Single speaker configuration
      speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore"
          }
        }
      };
    }

    // Call Google Generative AI API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: text
            }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig
          }
        }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API error:", response.status, errorText);
      throw new Error(`TTS generation failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract audio data from response
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      throw new Error("No audio data in response");
    }

    console.log("TTS generation completed, audio data received");

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/wav;base64,${audioData}`,
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
