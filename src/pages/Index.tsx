import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Mic, Download, Volume2, Split, LogOut, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-studio.jpg";
import sommyartLogo from "@/assets/sommyart-logo.jpg";
import { SpeakerConfig, Speaker } from "@/components/SpeakerConfig";
import { VoiceCloning } from "@/components/VoiceCloning";

const voiceOptions = [
  { value: "Kore", label: "Male Voice (Kore)" },
  { value: "Puck", label: "Female Voice (Puck)" },
  { value: "Charon", label: "Josmart (Male Deep)" },
  { value: "Orus", label: "Maazi (Male Elderly)" },
  { value: "Leda", label: "Chisom (Female Soft)" },
  { value: "Aoede", label: "Amara (Female Warm)" },
  { value: "Puck", label: "Mmesoma (Female Storyteller)" },
];

const defaultSpeakers: Speaker[] = [
  { id: crypto.randomUUID(), name: "Speaker1", voice: "Kore" },
  { id: crypto.randomUUID(), name: "Speaker2", voice: "Puck" },
];

// Default split voice mapping
const defaultSplitVoices = {
  male: "Kore",
  female: "Puck",
};

// Action tags that should pass through to TTS (not treated as voice switches)
const ACTION_TAGS = [
  "pause", "giggle", "giggles", "laugh", "laughs", "sigh", "sighs", 
  "gasp", "gasps", "cough", "coughs", "clears throat", "whisper", "whispers",
  "yawn", "yawns", "sob", "sobs", "cry", "cries", "chuckle", "chuckles",
  "sniff", "sniffs", "hum", "hums", "groan", "groans", "moan", "moans"
];

// Parse script with [MALE] and [FEMALE] tags and convert to speaker format
// Action tags like [pause], [giggles] are preserved and passed to TTS
const parseSplitVoiceScript = (script: string): string => {
  let parsed = script;
  
  // Handle [MALE] tags - convert to speaker format
  parsed = parsed.replace(/\[MALE\]\s*/gi, "\nMALE: ");
  
  // Handle [FEMALE] tags - convert to speaker format  
  parsed = parsed.replace(/\[FEMALE\]\s*/gi, "\nFEMALE: ");
  
  // Clean up any leading newlines
  parsed = parsed.replace(/^\n+/, "");
  
  // Clean up multiple consecutive newlines
  parsed = parsed.replace(/\n{3,}/g, "\n\n");
  
  return parsed.trim();
};

// Check if script contains split voice tags (MALE/FEMALE only, not action tags)
const hasSplitVoiceTags = (script: string): boolean => {
  // Match [MALE] or [FEMALE] but not action tags
  const voiceTagPattern = /\[(MALE|FEMALE)\]/i;
  return voiceTagPattern.test(script);
};

interface ClonedVoice {
  id: string;
  name: string;
  elevenlabs_voice_id: string;
  created_at: string;
}

type VoiceMode = "single" | "multi" | "split";

const Index = () => {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("single");
  const [speakers, setSpeakers] = useState<Speaker[]>(defaultSpeakers);
  const [splitVoices, setSplitVoices] = useState(defaultSplitVoices);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const { toast } = useToast();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Legacy compatibility
  const isMultiSpeaker = voiceMode === "multi";
  const setIsMultiSpeaker = (enabled: boolean) => setVoiceMode(enabled ? "multi" : "single");

  // Auto-play when new audio is generated
  useEffect(() => {
    if (generatedAudio && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        console.log("Auto-play prevented:", error);
        setIsPlaying(false);
        toast({
          title: "Audio Ready",
          description: "Click play to listen to your generated voice.",
        });
      });
    }
  }, [generatedAudio, toast]);

  // Reset playing state when audio ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [generatedAudio]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter some text to convert to voice.",
        variant: "destructive",
      });
      return;
    }

    if (text.length > 10000) {
      toast({
        title: "Text Too Long",
        description: "Please keep your text under 10,000 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedAudio(null);
    setIsPlaying(false);

    try {
      console.log("Generating TTS with Google Gemini, mode:", voiceMode);
      
      let processedText = text;
      let useSpeakers: { name: string; voice: string }[] | undefined;
      let useVoice: string | undefined;
      let useMultiSpeaker = false;

      if (voiceMode === "split") {
        // Split voice mode - parse [MALE] and [FEMALE] tags
        if (!hasSplitVoiceTags(text)) {
          toast({
            title: "No Voice Tags Found",
            description: "Please use [MALE] and [FEMALE] tags to mark different speakers in your script.",
            variant: "destructive",
          });
          setIsGenerating(false);
          return;
        }
        processedText = parseSplitVoiceScript(text);
        useSpeakers = [
          { name: "MALE", voice: splitVoices.male },
          { name: "FEMALE", voice: splitVoices.female },
        ];
        useMultiSpeaker = true;
        console.log("Parsed split voice script:", processedText);
      } else if (voiceMode === "multi") {
        // Multi-speaker mode
        useSpeakers = speakers.map(s => ({ name: s.name, voice: s.voice }));
        useMultiSpeaker = true;
      } else {
        // Single speaker mode - check if it's a cloned voice
        const clonedVoice = clonedVoices.find(v => v.elevenlabs_voice_id === selectedVoice);
        
        if (clonedVoice) {
          // Use ElevenLabs TTS for cloned voices
          console.log("Using ElevenLabs TTS for cloned voice:", clonedVoice.name);
          const { data: elData, error: elError } = await supabase.functions.invoke('elevenlabs-tts', {
            body: { text: processedText, voiceId: clonedVoice.elevenlabs_voice_id }
          });
          if (elError) throw elError;
          if (elData.success && elData.audioUrl) {
            setGeneratedAudio(elData.audioUrl);
            toast({ title: "Voice Generated!", description: "Your voiceover is ready." });
          } else {
            throw new Error(elData.error || "Failed to generate voice");
          }
          return;
        }
        
        useVoice = selectedVoice;
      }
      
      const { data, error } = await supabase.functions.invoke('generate-voice', {
        body: { 
          text: processedText,
          isMultiSpeaker: useMultiSpeaker,
          speakers: useSpeakers,
          voice: useVoice
        }
      });

      if (error) throw error;

      if (data.success && data.audioUrl) {
        setGeneratedAudio(data.audioUrl);
        
        toast({
          title: "Voice Generated!",
          description: "Your voiceover is ready and will play automatically.",
        });
      } else {
        throw new Error(data.error || "Failed to generate voice");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An error occurred during generation.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedAudio) return;
    
    const link = document.createElement('a');
    link.href = generatedAudio;
    link.download = `sommyart-gemini-voice-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Started",
      description: "Your voice file is being downloaded.",
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sign out - bottom left */}
      <div className="fixed bottom-4 left-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="bg-background/80 backdrop-blur-sm border-border/50 shadow-md"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
        
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <img 
              src={sommyartLogo} 
              alt="Sommyart Labs Logo" 
              className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-2xl shadow-lg mb-4"
            />
            
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
              Sommyart Labs
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your text into expressive AI voiceovers with professional quality. 
              Choose your voice style and bring your content to life.
            </p>
          </div>
        </div>
      </div>

      {/* Main Studio Section */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <Card className="p-8 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-card/80 border-border/50">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - Input */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary icon-3d-subtle" />
                  Your Script
                </label>
                <Textarea
                  placeholder="Type or paste your script here... Tell your story, share your message, or create engaging content."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[200px] resize-none bg-background/50 border-border/50 focus:border-primary transition-[var(--transition-smooth)]"
                />
                <p className={`text-xs ${text.length > 10000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {text.length}/10,000 characters
                </p>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  🎙️ Powered by <span className="font-semibold text-primary">Google Gemini 2.5 Flash TTS</span> - Natural-sounding voice synthesis
                </p>
              </div>

              {/* Voice Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary icon-3d-subtle" />
                  Voice Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={voiceMode === "single" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoiceMode("single")}
                    className="w-full"
                  >
                    Single
                  </Button>
                  <Button
                    variant={voiceMode === "multi" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoiceMode("multi")}
                    className="w-full"
                  >
                    Multi
                  </Button>
                  <Button
                    variant={voiceMode === "split" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoiceMode("split")}
                    className="w-full"
                  >
                    <Split className="w-3 h-3 mr-1 icon-3d-subtle" />
                    Split
                  </Button>
                </div>
              </div>

              {/* Split Voice Instructions */}
              {voiceMode === "split" && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                  <p className="text-sm font-medium text-foreground">Split Voice Mode</p>
                  
                  {/* Voice Selection for Split Mode */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">[MALE] Voice</label>
                      <Select value={splitVoices.male} onValueChange={(v) => setSplitVoices(prev => ({ ...prev, male: v }))}>
                        <SelectTrigger className="bg-background/50 border-border/50 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {voiceOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">[FEMALE] Voice</label>
                      <Select value={splitVoices.female} onValueChange={(v) => setSplitVoices(prev => ({ ...prev, female: v }))}>
                        <SelectTrigger className="bg-background/50 border-border/50 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {voiceOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Use <code className="px-1 py-0.5 bg-muted rounded text-primary">[MALE]</code> and{" "}
                    <code className="px-1 py-0.5 bg-muted rounded text-primary">[FEMALE]</code> tags to switch between voices.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add actions like <code className="px-1 py-0.5 bg-muted rounded text-accent">[pause]</code>,{" "}
                    <code className="px-1 py-0.5 bg-muted rounded text-accent">[giggles]</code>,{" "}
                    <code className="px-1 py-0.5 bg-muted rounded text-accent">[sigh]</code> for expressive speech.
                  </p>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                    <p>[MALE] Hello, welcome to our show!</p>
                    <p>[FEMALE] [giggles] Thanks for having me today.</p>
                    <p>[MALE] [pause] Let's get started.</p>
                  </div>
                </div>
              )}

              {/* Multi-Speaker Config */}
              {voiceMode === "multi" && (
                <SpeakerConfig
                  speakers={speakers}
                  onSpeakersChange={setSpeakers}
                  isMultiSpeaker={true}
                  onMultiSpeakerChange={() => {}}
                />
              )}

              {/* Single Voice Selection */}
              {voiceMode === "single" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Voice Selection</label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue placeholder="Choose a voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {voiceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                          {option.label}
                        </SelectItem>
                      ))}
                      {clonedVoices.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t border-border mt-1 pt-2">
                            🎤 Your Cloned Voices
                          </div>
                          {clonedVoices.map((cv) => (
                            <SelectItem key={cv.elevenlabs_voice_id} value={cv.elevenlabs_voice_id} className="cursor-pointer">
                              {cv.name} (Cloned)
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                variant="studio"
                size="lg"
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Voice...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 icon-3d" />
                    Generate Voice
                  </>
                )}
              </Button>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary icon-3d-subtle" />
                  Preview & Download
                </label>
                
                <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/10 border-border/30 min-h-[200px] flex flex-col items-center justify-center">
                  {!generatedAudio && !isGenerating && (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Volume2 className="w-8 h-8 text-primary/50 icon-3d" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your generated voice will appear here
                      </p>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="text-center space-y-3">
                      <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Creating your voiceover...
                      </p>
                    </div>
                  )}

                  {generatedAudio && !isGenerating && (
                    <div className="w-full space-y-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={togglePlayPause}
                          className="w-16 h-16 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          {isPlaying ? (
                            <Pause className="w-8 h-8 text-primary icon-3d" />
                          ) : (
                            <Play className="w-8 h-8 text-primary icon-3d ml-1" />
                          )}
                        </button>
                      </div>
                      
                      <div className="w-full">
                        <audio 
                          ref={audioRef}
                          controls 
                          className="w-full"
                          src={generatedAudio}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                        >
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {generatedAudio && (
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <Download className="w-5 h-5 icon-3d-subtle" />
                  Download Voice
                </Button>
              )}

              <VoiceCloning onVoicesChange={setClonedVoices} />

              <Card className="p-4 bg-accent/5 border-accent/20">
                <h3 className="text-sm font-semibold mb-2 text-foreground">💡 Pro Tips</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Keep sentences clear and well-punctuated</li>
                  <li>• Use natural language for best results</li>
                  <li>• Try different voices to find your perfect match</li>
                  <li>• Clone your own voice for personalized audio</li>
                </ul>
              </Card>
            </div>
          </div>
        </Card>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-card to-muted/20 border-border/50">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-6 h-6 text-primary icon-3d" />
            </div>
            <h3 className="font-semibold">AI Voice Generation</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Google Gemini 2.5 Flash for natural-sounding voice synthesis
            </p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-card to-muted/20 border-border/50">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-accent icon-3d" />
            </div>
            <h3 className="font-semibold">Voice Selection</h3>
            <p className="text-sm text-muted-foreground">
              Choose between male and female voices for your content
            </p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-card to-muted/20 border-border/50">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="w-6 h-6 text-primary icon-3d" />
            </div>
            <h3 className="font-semibold">Instant Download</h3>
            <p className="text-sm text-muted-foreground">
              Preview and download your generated voiceovers immediately
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
