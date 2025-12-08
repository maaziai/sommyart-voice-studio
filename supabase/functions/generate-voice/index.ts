import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
  voice?: string;
}

// Create WAV header for PCM audio data
function createWavHeader(pcmDataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Uint8Array {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmDataLength;
  const chunkSize = 36 + dataSize;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, chunkSize, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666D7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true); // Subchunk2Size

  return new Uint8Array(header);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, isMultiSpeaker, speakers, voice }: RequestBody = await req.json();
    
    console.log("Generating Google Gemini TTS audio for text:", text?.substring(0, 50));
    console.log("Multi-speaker mode:", isMultiSpeaker, "Speakers:", speakers?.length, "Voice:", voice);

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
      // Single speaker configuration - use provided voice or default to Kore
      speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice || "Kore"
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
    
    // Extract audio data and MIME type from response
    const inlineData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const audioData = inlineData?.data;
    const mimeType = inlineData?.mimeType || "audio/L16;rate=24000";
    
    if (!audioData) {
      throw new Error("No audio data in response");
    }

    console.log("TTS generation completed, MIME type:", mimeType);

    // Decode the base64 PCM data
    const pcmData = base64Decode(audioData);
    
    // Create WAV header and combine with PCM data
    const wavHeader = createWavHeader(pcmData.length);
    const wavData = new Uint8Array(wavHeader.length + pcmData.length);
    wavData.set(wavHeader, 0);
    wavData.set(pcmData, wavHeader.length);
    
    // Encode the complete WAV file as base64
    const wavBase64 = base64Encode(wavData.buffer);

    console.log("WAV file created, size:", wavData.length, "bytes");

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/wav;base64,${wavBase64}`,
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