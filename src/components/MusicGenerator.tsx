import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Music, Download, Play, Pause, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MusicModel = "lyria-3-clip-preview" | "lyria-3-pro-preview";

const examplePrompts = [
  "A 30-second lofi hip hop beat with mellow Rhodes piano, vinyl crackle, and a slow boom-bap drum pattern at 85 BPM. Instrumental only.",
  "An upbeat feel-good pop song in G major at 120 BPM with bright acoustic guitar, claps, and warm vocal harmonies about a summer road trip.",
  "A dark atmospheric trap beat at 140 BPM with heavy 808 bass, eerie synth pads, and sharp hi-hats. In D minor.",
];

const MusicGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<MusicModel>("lyria-3-clip-preview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [audioUrl]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Prompt Required", description: "Describe the music you want to create.", variant: "destructive" });
      return;
    }
    if (prompt.length > 5000) {
      toast({ title: "Prompt Too Long", description: "Keep your prompt under 5,000 characters.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);
    setLyrics("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: { prompt, model },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Music generation failed");

      setAudioUrl(data.audioUrl);
      setLyrics(data.lyrics || "");
      toast({ title: "Music Ready 🎵", description: "Your track has been generated." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate music";
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `sommyart-music-${Date.now()}.mp3`;
    a.click();
  };

  return (
    <Card className="p-6 md:p-8 bg-gradient-to-br from-card via-card to-muted/20 border-border/50 shadow-[var(--shadow-elegant)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
          <Music className="w-5 h-5 text-accent icon-3d" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Music Studio</h2>
          <p className="text-sm text-muted-foreground">Generate music with Lyria 3 — clips or full songs</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent icon-3d-subtle" />
              Music Prompt
            </label>
            <Textarea
              placeholder="Describe genre, instruments, BPM, key, mood... e.g. 'A dreamy indie pop song at 110 BPM with reverb-soaked guitar and soft vocals'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[160px] resize-none bg-background/50 border-border/50 focus:border-primary"
            />
            <p className={`text-xs ${prompt.length > 5000 ? "text-destructive" : "text-muted-foreground"}`}>
              {prompt.length}/5,000 characters
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Model</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={model === "lyria-3-clip-preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setModel("lyria-3-clip-preview")}
              >
                Clip (30s)
              </Button>
              <Button
                variant={model === "lyria-3-pro-preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setModel("lyria-3-pro-preview")}
              >
                Pro (Full song)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {model === "lyria-3-clip-preview"
                ? "Fast 30-second clip — great for previews and loops."
                : "Multi-minute composition with verses, choruses, bridges."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Try an example</label>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(p)}
                  className="text-xs px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Example {i + 1}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            variant="studio"
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {model === "lyria-3-pro-preview" ? "Composing song (this can take a few minutes)..." : "Generating clip..."}
              </>
            ) : (
              <>
                <Music className="w-5 h-5 icon-3d" />
                Generate Music
              </>
            )}
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/10 border-border/30 min-h-[200px] flex flex-col items-center justify-center">
            {!audioUrl && !isGenerating && (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                  <Music className="w-8 h-8 text-accent/60 icon-3d" />
                </div>
                <p className="text-sm text-muted-foreground">Your generated track will appear here</p>
              </div>
            )}
            {isGenerating && (
              <div className="text-center space-y-3">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Composing your music...</p>
              </div>
            )}
            {audioUrl && !isGenerating && (
              <div className="w-full space-y-4">
                <div className="flex justify-center">
                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? <Pause className="w-8 h-8 text-accent icon-3d" /> : <Play className="w-8 h-8 text-accent icon-3d ml-1" />}
                  </button>
                </div>
                <audio
                  ref={audioRef}
                  controls
                  className="w-full"
                  src={audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </div>
            )}
          </Card>

          {audioUrl && (
            <Button onClick={handleDownload} variant="outline" size="lg" className="w-full">
              <Download className="w-5 h-5 icon-3d-subtle" />
              Download MP3
            </Button>
          )}

          {lyrics && (
            <Card className="p-4 bg-muted/30 border-border/40 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">Lyrics & Structure</h3>
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono">{lyrics}</pre>
            </Card>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MusicGenerator;
