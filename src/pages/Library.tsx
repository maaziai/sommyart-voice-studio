import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Play, Pause, Download, ArrowLeft, Volume2, Clock, Mic } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Generation {
  id: string;
  text_input: string;
  voice_id: string;
  voice_mode: string;
  audio_url: string | null;
  created_at: string;
}

const Library = () => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchGenerations();
  }, [user]);

  const fetchGenerations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching generations:", error);
      toast({ title: "Error", description: "Failed to load your sessions.", variant: "destructive" });
    } else {
      setGenerations(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("generations").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete session.", variant: "destructive" });
    } else {
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      toast({ title: "Deleted", description: "Session removed successfully." });
    }
    setDeletingId(null);
  };

  const togglePlay = (gen: Generation) => {
    if (!gen.audio_url) return;

    if (playingId === gen.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.src = gen.audio_url;
      audioRef.current.play();
      setPlayingId(gen.id);
    }
  };

  const handleDownload = (gen: Generation) => {
    if (!gen.audio_url) return;
    const link = document.createElement("a");
    link.href = gen.audio_url;
    link.download = `sommyart-voice-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId(null)}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/studio")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Session Library</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your past voice generations
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : generations.length === 0 ? (
          <Card className="p-12 text-center border-border/50">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Volume2 className="w-8 h-8 text-primary/50" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No sessions yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Generate your first voice in the studio to see it here.
            </p>
            <Button onClick={() => navigate("/studio")}>Go to Studio</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {generations.map((gen) => (
              <Card
                key={gen.id}
                className="p-4 border-border/50 bg-gradient-to-br from-card to-card/80 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Play button */}
                  <button
                    onClick={() => togglePlay(gen)}
                    disabled={!gen.audio_url}
                    className="mt-1 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
                  >
                    {playingId === gen.id ? (
                      <Pause className="w-4 h-4 text-primary" />
                    ) : (
                      <Play className="w-4 h-4 text-primary ml-0.5" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2 mb-2">
                      {gen.text_input}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mic className="w-3 h-3" />
                        {gen.voice_mode} · {gen.voice_id}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(gen.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {gen.audio_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(gen)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The generation will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(gen.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === gen.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
