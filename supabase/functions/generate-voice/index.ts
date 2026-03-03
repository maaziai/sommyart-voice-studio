import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ElevenLabs voice ID mapping
const VOICE_MAP: Record<string, string> = {
  "Brian": "nPczCjzI2devNBz1zQrb",
  "Sarah": "EXAVITQu4vr4xnSDxMaL",
  "George": "JBFqnCBsd6RMkjVDRZzb",
  "Bill": "pqHfZKP75CvOlQylNhV4",
  "Lily": "pFZP5JQG7iQjIQuC4Bku",
  "Alice": "Xb7hH8MSUJpSbSDYk0k2",
  "Liam": "TX3LPaxmHKxFdv7VOQHJ",
  "River": "SAz9YHcvj6GT2YYXdXww",
};

const VALID_VOICES = Object.keys(VOICE_MAP);

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIp);
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) return false;
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

// Generate TTS audio for a single text segment using ElevenLabs
async function generateSegment(text: string, voiceId: string, apiKey: string): Promise<Uint8Array> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("ElevenLabs API error:", response.status, errText);
    if (response.status === 429) {
      throw new Error("Service is currently busy. Please try again in a moment.");
    } else if (response.status >= 500) {
      throw new Error("Voice generation service temporarily unavailable.");
    } else {
      throw new Error("Voice generation failed. Please check your input and try again.");
    }
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// Parse multi-speaker text into segments: [{speaker, text}]
function parseMultiSpeakerText(text: string, speakers: Speaker[]): { speaker: string; text: string }[] {
  const speakerNames = speakers.map(s => s.name);
  // Build regex to split by "SpeakerName:" pattern
  const pattern = new RegExp(`^(${speakerNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):\\s*`, 'gmi');
  
  const segments: { speaker: string; text: string }[] = [];
  let lastIndex = 0;
  let lastSpeaker = speakerNames[0];
  
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    let matched = false;
    for (const name of speakerNames) {
      if (trimmed.toLowerCase().startsWith(name.toLowerCase() + ':')) {
        const content = trimmed.substring(name.length + 1).trim();
        if (content) {
          segments.push({ speaker: name, text: content });
        }
        matched = true;
        break;
      }
    }
    if (!matched && trimmed) {
      // Assign to last speaker or first speaker
      const prevSpeaker = segments.length > 0 ? segments[segments.length - 1].speaker : speakerNames[0];
      segments.push({ speaker: prevSpeaker, text: trimmed });
    }
  }
  
  return segments;
}

// Encode Uint8Array to base64
function uint8ToBase64(uint8: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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

    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || userId || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment.", success: false }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, isMultiSpeaker, speakers, voice }: RequestBody = await req.json();

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }
    const sanitizedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    if (sanitizedText.length === 0) throw new Error("Text is required");
    if (sanitizedText.length > 10000) throw new Error("Text exceeds maximum length of 10,000 characters.");

    // Validate voice
    if (voice && !VALID_VOICES.includes(voice)) {
      throw new Error("Invalid voice selection.");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("Voice generation service is not properly configured.");
    }

    let audioData: Uint8Array;

    if (isMultiSpeaker && speakers && speakers.length >= 2) {
      // Validate speakers
      if (speakers.length > 10) throw new Error("Too many speakers. Maximum is 10.");
      for (const s of speakers) {
        if (!s.voice || !VALID_VOICES.includes(s.voice)) throw new Error("Invalid speaker voice.");
        if (!s.name || s.name.length < 1 || s.name.length > 50) throw new Error("Invalid speaker name.");
      }

      // Build voice lookup
      const voiceLookup: Record<string, string> = {};
      for (const s of speakers) {
        voiceLookup[s.name.toLowerCase()] = VOICE_MAP[s.voice];
      }

      // Parse text into segments
      const segments = parseMultiSpeakerText(sanitizedText, speakers);
      console.log(`Multi-speaker: ${segments.length} segments for ${speakers.length} speakers`);

      if (segments.length === 0) {
        throw new Error("Could not parse speaker segments. Use 'SpeakerName: text' format.");
      }

      // Generate each segment sequentially (to preserve order)
      const audioChunks: Uint8Array[] = [];
      for (const seg of segments) {
        const elVoiceId = voiceLookup[seg.speaker.toLowerCase()] || VOICE_MAP[speakers[0].voice];
        console.log(`Generating segment for ${seg.speaker} (${seg.text.substring(0, 40)}...)`);
        const chunk = await generateSegment(seg.text, elVoiceId, ELEVENLABS_API_KEY);
        audioChunks.push(chunk);
      }

      // Concatenate MP3 chunks
      const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
      audioData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      // Single speaker
      const voiceName = voice || "Brian";
      const elVoiceId = VOICE_MAP[voiceName];
      if (!elVoiceId) throw new Error("Invalid voice selection.");

      console.log(`Single speaker: ${voiceName} (${elVoiceId})`);
      audioData = await generateSegment(sanitizedText, elVoiceId, ELEVENLABS_API_KEY);
    }

    console.log("Audio generated, size:", audioData.length, "bytes");
    const base64 = uint8ToBase64(audioData);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/mpeg;base64,${base64}`,
        message: "Voice generated successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-voice:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
