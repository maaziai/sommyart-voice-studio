// SOMMYART TTS VOICE ENGINE
// Browser-based speech synthesis using the Web Speech API.
// Used as a free, offline-capable alternative to the Gemini TTS backend.

export type SommyartVoiceKey = "Sommyart-Male" | "Baba" | "Mmesoma" | "Mama";

export interface SommyartVoiceProfile {
  name: SommyartVoiceKey;
  label: string;
  description: string;
  rate: number;
  pitch: number;
  volume: number;
  voiceMatch: string[];
  preferredGender?: "male" | "female";
}

export const sommyartVoiceProfiles: Record<SommyartVoiceKey, SommyartVoiceProfile> = {
  "Sommyart-Male": {
    name: "Sommyart-Male",
    label: "Sommyart - Male (Nigerian)",
    description: "Confident Nigerian-styled male narrator",
    rate: 0.9,
    pitch: 0.8,
    volume: 1,
    voiceMatch: ["en-NG", "en-GB", "en-US"],
    preferredGender: "male",
  },
  Baba: {
    name: "Baba",
    label: "Baba - Old Man",
    description: "Slow, deep voice of a wise elder",
    rate: 0.75,
    pitch: 0.6,
    volume: 1,
    voiceMatch: ["en-GB", "en-US"],
    preferredGender: "male",
  },
  Mmesoma: {
    name: "Mmesoma",
    label: "Mmesoma - Storyteller",
    description: "Bright, expressive female storyteller",
    rate: 0.95,
    pitch: 1.2,
    volume: 1,
    voiceMatch: ["en-NG", "en-US"],
    preferredGender: "female",
  },
  Mama: {
    name: "Mama",
    label: "Mama - African Grandma",
    description: "Warm, gentle grandmotherly tone",
    rate: 0.8,
    pitch: 0.7,
    volume: 1,
    voiceMatch: ["en-GB", "en-US"],
    preferredGender: "female",
  },
};

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function getBestVoice(profile: SommyartVoiceProfile): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  if (!voices.length) return null;

  // Try gender-aware match within preferred languages
  for (const lang of profile.voiceMatch) {
    const langMatches = voices.filter((v) => v.lang.toLowerCase().includes(lang.toLowerCase()));
    if (!langMatches.length) continue;

    if (profile.preferredGender) {
      const genderHint = profile.preferredGender === "male"
        ? /(male|man|david|daniel|google uk english male|alex)/i
        : /(female|woman|samantha|victoria|google uk english female|karen|tessa)/i;
      const genderMatch = langMatches.find((v) => genderHint.test(v.name));
      if (genderMatch) return genderMatch;
    }
    return langMatches[0];
  }

  return voices[0];
}

export function isSommyartTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakSommyartOptions {
  text: string;
  profileKey: SommyartVoiceKey;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: SpeechSynthesisErrorEvent) => void;
}

export function speakSommyart({ text, profileKey, onStart, onEnd, onError }: SpeakSommyartOptions): void {
  if (!isSommyartTTSSupported() || !text.trim()) return;
  const profile = sommyartVoiceProfiles[profileKey];
  if (!profile) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getBestVoice(profile);
  if (voice) utterance.voice = voice;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = profile.volume;
  utterance.lang = voice?.lang || profile.voiceMatch[0] || "en-US";

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  synth.speak(utterance);
}

export function stopSommyart(): void {
  if (isSommyartTTSSupported()) window.speechSynthesis.cancel();
}

export function pauseSommyart(): void {
  if (isSommyartTTSSupported()) window.speechSynthesis.pause();
}

export function resumeSommyart(): void {
  if (isSommyartTTSSupported()) window.speechSynthesis.resume();
}
