import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gemini TTS voice names (plus persona aliases mapped below)
const VALID_VOICES = [
  "Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr",
  "Uzoma", "Ebuka",
];

// Persona voices: map to a real Gemini voice and prepend a style instruction
const VOICE_PERSONAS: Record<string, { baseVoice: string; styleInstruction: string }> = {
  Uzoma: {
    baseVoice: "Aoede",
    styleInstruction:
      "Speak as Uzoma, a middle-aged Nigerian woman with a thick, warm Nigerian accent. Use natural Nigerian English intonation, rhythm, and cadence throughout. Say the following naturally:",
  },
  Ebuka: {
    baseVoice: "Puck",
    styleInstruction:
      "Speak as Ebuka, a middle-aged Nigerian man with a thick, warm Nigerian accent. Use natural Nigerian English intonation, rhythm, and cadence throughout. Say the following naturally:",
  },
};

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const GEMINI_TTS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

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

// Create a WAV header for raw PCM data (16-bit, mono, 24kHz)
function createWavHeader(pcmLength: number): Uint8Array {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmLength;
  const fileSize = 36 + dataSize;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return new Uint8Array(header);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Call Gemini TTS API
async function callGeminiTTS(
  text: string,
  apiKey: string,
  voiceName?: string,
  speakers?: Speaker[]
): Promise<Uint8Array> {
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["AUDIO"],
  };

  let effectiveText = text;
  const styleParts: string[] = [];

  if (speakers && speakers.length >= 2) {
    // Multi-speaker config: resolve personas to base voices; collect per-speaker style hints
    const resolvedSpeakers = speakers.map((s) => {
      const persona = VOICE_PERSONAS[s.voice];
      if (persona) {
        styleParts.push(`${s.name}: ${persona.styleInstruction}`);
        return { ...s, voice: persona.baseVoice };
      }
      return s;
    });
    if (styleParts.length > 0) {
      effectiveText = `${styleParts.join(" ")}\n\n${text}`;
    }
    generationConfig.speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: resolvedSpeakers.map((s) => ({
          speaker: s.name,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: s.voice,
            },
          },
        })),
      },
    };
  } else {
    // Single speaker config: resolve persona if applicable
    const requested = voiceName || "Kore";
    const persona = VOICE_PERSONAS[requested];
    const resolvedVoice = persona ? persona.baseVoice : requested;
    if (persona) {
      effectiveText = `${persona.styleInstruction}\n\n${text}`;
    }
    generationConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: resolvedVoice,
        },
      },
    };
  }

  const response = await fetch(`${GEMINI_TTS_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: effectiveText }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini TTS API error:", response.status, errText);
    if (response.status === 429) {
      throw new Error("Service is currently busy. Please try again in a moment.");
    } else if (response.status >= 500) {
      throw new Error("Voice generation service temporarily unavailable.");
    } else {
      throw new Error("Voice generation failed. Please check your input and try again.");
    }
  }

  const data = await response.json();
  const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error("No audio data returned from the service.");
  }

  // Decode base64 to raw PCM bytes
  const binaryStr = atob(audioBase64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }

  return pcmBytes;
}


// Split long text into chunks (<= maxLen) on line/sentence boundaries
function chunkText(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text];
  const pieces = text.split(/(?<=[.!?\n])\s+/);
  const chunks: string[] = [];
  let cur = "";
  for (let p of pieces) {
    while (p.length > maxLen) {
      if (cur) { chunks.push(cur); cur = ""; }
      chunks.push(p.slice(0, maxLen));
      p = p.slice(maxLen);
    }
    if ((cur + " " + p).length > maxLen && cur) { chunks.push(cur); cur = p; }
    else cur = cur ? cur + " " + p : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function generateChunked(
  text: string, apiKey: string, voiceName?: string, speakers?: Speaker[]
): Promise<Uint8Array> {
  const chunks = chunkText(text);
  const results: Uint8Array[] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          results[i] = await callGeminiTTS(chunks[i], apiKey, voiceName, speakers);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (lastErr) throw lastErr;
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, worker));
  const total = results.reduce((n, r) => n + r.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const r of results) { out.set(r, off); off += r.length; }
  return out;
}

// Parse multi-speaker text into segments
function parseMultiSpeakerText(
  text: string,
  speakers: Speaker[]
): { speaker: string; text: string }[] {
  const speakerNames = speakers.map((s) => s.name);
  const segments: { speaker: string; text: string }[] = [];

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const name of speakerNames) {
      if (trimmed.toLowerCase().startsWith(name.toLowerCase() + ":")) {
        const content = trimmed.substring(name.length + 1).trim();
        if (content) {
          segments.push({ speaker: name, text: content });
        }
        matched = true;
        break;
      }
    }
    if (!matched && trimmed) {
      const prevSpeaker =
        segments.length > 0
          ? segments[segments.length - 1].speaker
          : speakerNames[0];
      segments.push({ speaker: prevSpeaker, text: trimmed });
    }
  }

  return segments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP (no auth required)
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
        p_identifier: `voice:${clientIp}`,
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


    const { text, isMultiSpeaker, speakers, voice }: RequestBody = await req.json();

    // Validate text
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Text is required and cannot be empty");
    }
    const sanitizedText = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
    if (sanitizedText.length === 0) throw new Error("Text is required");
    if (sanitizedText.length > 10000)
      throw new Error("Text exceeds maximum length of 10,000 characters.");

    // Validate voice
    if (voice && !VALID_VOICES.includes(voice)) {
      throw new Error("Invalid voice selection.");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("Voice generation service is not properly configured.");
    }

    let pcmData: Uint8Array;

    if (isMultiSpeaker && speakers && speakers.length >= 2) {
      // Validate speakers
      if (speakers.length > 10) throw new Error("Too many speakers. Maximum is 10.");
      for (const s of speakers) {
        if (!s.voice || !VALID_VOICES.includes(s.voice))
          throw new Error("Invalid speaker voice.");
        if (!s.name || s.name.length < 1 || s.name.length > 50)
          throw new Error("Invalid speaker name.");
      }

      // For Gemini multi-speaker, we pass the full text with speaker names
      // The API handles multi-speaker natively when using multiSpeakerVoiceConfig
      console.log(
        `Multi-speaker: ${speakers.length} speakers, text length: ${sanitizedText.length}`
      );

      pcmData = await generateChunked(sanitizedText, GOOGLE_API_KEY, undefined, speakers);
    } else {
      // Single speaker
      const voiceName = voice || "Kore";
      console.log(`Single speaker: ${voiceName}`);
      pcmData = await generateChunked(sanitizedText, GOOGLE_API_KEY, voiceName);
    }

    // Wrap PCM in WAV
    const wavHeader = createWavHeader(pcmData.length);
    const wavData = new Uint8Array(wavHeader.length + pcmData.length);
    wavData.set(wavHeader, 0);
    wavData.set(pcmData, wavHeader.length);

    console.log("Audio generated, WAV size:", wavData.length, "bytes");
    const base64 = base64Encode(wavData);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/wav;base64,${base64}`,
        message: "Voice generated successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-voice:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
