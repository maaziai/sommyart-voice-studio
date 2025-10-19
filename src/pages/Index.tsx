import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mic, Download, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-studio.jpg";

const languages = [
  { value: "en", label: "English 🇬🇧", icon: "🇬🇧" },
  { value: "fr", label: "French 🇫🇷", icon: "🇫🇷" },
  { value: "es", label: "Spanish 🇪🇸", icon: "🇪🇸" },
  { value: "de", label: "German 🇩🇪", icon: "🇩🇪" },
  { value: "it", label: "Italian 🇮🇹", icon: "🇮🇹" },
  { value: "pt", label: "Portuguese 🇵🇹", icon: "🇵🇹" },
];

const backgroundMusic = [
  { value: "none", label: "No Music" },
  { value: "calm_ambient", label: "Calm Ambient" },
  { value: "inspiring_piano", label: "Inspiring Piano" },
  { value: "cinematic_bg", label: "Cinematic Background" },
  { value: "corporate_beat", label: "Corporate Beat" },
];

const Index = () => {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [slow, setSlow] = useState(false);
  const [music, setMusic] = useState("none");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [voiceDescription, setVoiceDescription] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Auto-play when new audio is generated
  useEffect(() => {
    if (generatedAudio) {
      const audio = new Audio(generatedAudio);
      audio.play().catch((error) => {
        console.log("Auto-play prevented:", error);
        toast({
          title: "Audio Ready",
          description: "Click play to listen to your generated voice.",
        });
      });
    }
  }, [generatedAudio, toast]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter some text to convert to voice.",
        variant: "destructive",
      });
      return;
    }

    if (text.length > 3000) {
      toast({
        title: "Text Too Long",
        description: "Please keep your text under 3000 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedAudio(null);
    setVoiceDescription("");

    try {
      console.log("Generating TTS with gTTS:", { lang: language, slow });
      
      const { data, error } = await supabase.functions.invoke('generate-voice', {
        body: { text, lang: language, slow }
      });

      if (error) throw error;

      if (data.success && data.audioUrl) {
        setGeneratedAudio(data.audioUrl);
        const speedText = slow ? "slow" : "normal";
        const langName = languages.find(l => l.value === language)?.label || language;
        setVoiceDescription(`Generated in ${langName} at ${speedText} speed`);
        
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
    link.download = `sommyart-voice-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Started",
      description: "Your voice file is being downloaded.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
        
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Volume2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Voice Studio</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
              Sommyart Text-to-Voice Studio
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your text into expressive AI voiceovers with professional quality. 
              Choose your voice style, add background music, and bring your content to life.
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
                  <Mic className="w-4 h-4 text-primary" />
                  Your Script
                </label>
                <Textarea
                  placeholder="Type or paste your script here... Tell your story, share your message, or create engaging content."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[200px] resize-none bg-background/50 border-border/50 focus:border-primary transition-[var(--transition-smooth)]"
                />
                <p className="text-xs text-muted-foreground">
                  {text.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {languages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span>{lang.icon}</span>
                          <span>{lang.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
                <input
                  type="checkbox"
                  id="slow"
                  checked={slow}
                  onChange={(e) => setSlow(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="slow" className="text-sm font-medium cursor-pointer">
                  Slow speed (better for learning)
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Background Music</label>
                <Select value={music} onValueChange={setMusic}>
                  <SelectTrigger className="bg-background/50 border-border/50">
                    <SelectValue placeholder="Choose music (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {backgroundMusic.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    <Mic className="w-5 h-5" />
                    Generate Voice
                  </>
                )}
              </Button>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  Preview & Download
                </label>
                
                <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/10 border-border/30 min-h-[200px] flex flex-col items-center justify-center">
                  {!generatedAudio && !isGenerating && (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Volume2 className="w-8 h-8 text-primary/50" />
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
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                          <Volume2 className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      
                      {voiceDescription && (
                        <div className="p-4 bg-background/50 rounded-lg border border-border/30">
                          <p className="text-sm text-muted-foreground italic">
                            {voiceDescription}
                          </p>
                        </div>
                      )}
                      
                      <div className="w-full">
                        <audio 
                          controls 
                          className="w-full"
                          src={generatedAudio}
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
                  <Download className="w-5 h-5" />
                  Download Voice
                </Button>
              )}

              <Card className="p-4 bg-accent/5 border-accent/20">
                <h3 className="text-sm font-semibold mb-2 text-foreground">💡 Pro Tips</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Keep sentences clear and well-punctuated</li>
                  <li>• Choose voice styles that match your content</li>
                  <li>• Add background music for professional polish</li>
                  <li>• Preview before downloading for best results</li>
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
              <Mic className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold">Multiple Voice Styles</h3>
            <p className="text-sm text-muted-foreground">
              Choose from professional voice actors with different tones and emotions
            </p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-card to-muted/20 border-border/50">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold">Background Music</h3>
            <p className="text-sm text-muted-foreground">
              Add professional soundtracks to enhance your voiceovers
            </p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-card to-muted/20 border-border/50">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" />
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
