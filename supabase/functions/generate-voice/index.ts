import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid voice names for validation
const VALID_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIp);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  clientData.count++;
  return true;
}

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

// Create WAV header for PCM audio data - returns base64 string
function createWavHeaderBase64(pcmDataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmDataLength;
  const chunkSize = 36 + dataSize;

  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

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

  // Convert to base64 using btoa
  let binary = '';
  for (let i = 0; i < header.length; i++) {
    binary += String.fromCharCode(header[i]);
  }
  return btoa(binary);
}

// Calculate PCM data length from base64 string length
function getPcmLengthFromBase64(base64Length: number): number {
  // Base64 encodes 3 bytes into 4 characters
  return Math.floor((base64Length * 3) / 4);
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", success: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Extract client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     userId || "unknown";
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.warn("Rate limit exceeded for IP:", clientIp);
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please wait a moment before trying again.",
          success: false 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { text, isMultiSpeaker, speakers, voice }: RequestBody = await req.json();
    
    console.log("Generating Google Gemini TTS audio");
    console.log("Multi-speaker mode:", isMultiSpeaker, "Speakers:", speakers?.length);

    // Server-side input validation - reduced limit to prevent memory issues
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }

    // Sanitize text input - remove control characters and null bytes
    const sanitizedText = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except tab, newline, carriage return
      .trim();

    if (sanitizedText.length === 0) {
      throw new Error("Text is required and cannot be empty after sanitization");
    }

    if (sanitizedText.length > 5000) {
      throw new Error("Text exceeds maximum length of 5000 characters. Please use shorter text.");
    }

    // Validate voice parameter
    if (voice && !VALID_VOICES.includes(voice)) {
      throw new Error("Invalid voice selection. Please choose a valid voice.");
    }

    // Validate speaker voices if multi-speaker mode
    if (isMultiSpeaker && speakers && Array.isArray(speakers) && speakers.length > 0) {
      // Limit number of speakers
      if (speakers.length > 10) {
        throw new Error("Too many speakers. Maximum is 10.");
      }
      
      for (const speaker of speakers) {
        if (!speaker.voice || !VALID_VOICES.includes(speaker.voice)) {
          throw new Error("Invalid speaker voice selection. Please choose valid voices.");
        }
        // Enhanced speaker name validation - must start and end with alphanumeric
        if (!speaker.name || 
            typeof speaker.name !== 'string' ||
            speaker.name.length < 1 || 
            speaker.name.length > 50 || 
            !/^[a-zA-Z0-9][a-zA-Z0-9\s-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(speaker.name)) {
          throw new Error("Invalid speaker name. Names must be 1-50 alphanumeric characters, optionally with spaces or hyphens.");
        }
      }
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_API_KEY not configured");
      throw new Error("Voice generation service is not properly configured.");
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

    // Call Google Generative AI API with sanitized text
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
              text: sanitizedText
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
      
      // Return generic error messages to client
      if (response.status === 429) {
        throw new Error("Service is currently busy. Please try again in a moment.");
      } else if (response.status >= 500) {
        throw new Error("Voice generation service temporarily unavailable.");
      } else {
        throw new Error("Voice generation failed. Please check your input and try again.");
      }
    }

    const result = await response.json();
    
    // Extract audio data (base64 PCM) from response
    const inlineData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const pcmBase64 = inlineData?.data;
    
    if (!pcmBase64) {
      console.error("No audio data in Google API response");
      throw new Error("Voice generation failed. Please try again.");
    }

    console.log("TTS generation completed, PCM base64 length:", pcmBase64.length);

    // Calculate PCM data length and create WAV header as base64
    const pcmLength = getPcmLengthFromBase64(pcmBase64.length);
    const wavHeaderBase64 = createWavHeaderBase64(pcmLength);

    // Combine header and PCM data as base64 strings
    // We decode both to binary, concatenate, then re-encode
    // This is more memory efficient than creating large Uint8Arrays
    const headerBinary = atob(wavHeaderBase64);
    const pcmBinary = atob(pcmBase64);
    const wavBase64 = btoa(headerBinary + pcmBinary);

    console.log("WAV file created, approximate size:", Math.floor((wavBase64.length * 3) / 4), "bytes");

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
        error: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
