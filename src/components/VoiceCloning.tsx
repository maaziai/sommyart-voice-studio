import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mic, Upload, Trash2, StopCircle, AudioLines } from "lucide-react";

interface ClonedVoice {
  id: string;
  name: string;
  elevenlabs_voice_id: string;
  created_at: string;
}

interface VoiceCloningProps {
  onVoicesChange?: (voices: ClonedVoice[]) => void;
}

export function VoiceCloning({ onVoicesChange }: VoiceCloningProps) {
  const [voiceName, setVoiceName] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchVoices = useCallback(async () => {
    if (!user) return;
    try {
      const formData = new FormData();
      formData.append("action", "list");

      const { data, error } = await supabase.functions.invoke("clone-voice", {
        body: formData,
      });
      if (error) throw error;
      const voices = data.voices || [];
      setClonedVoices(voices);
      onVoicesChange?.(voices);
    } catch (err) {
      console.error("Failed to fetch cloned voices:", err);
    } finally {
      setLoadingVoices(false);
    }
  }, [user, onVoicesChange]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setUploadedFile(null);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
    } catch {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to record your voice.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
    setRecordedBlob(null);
  };

  const handleClone = async () => {
    const audioSource = recordedBlob || uploadedFile;
    if (!audioSource || !voiceName.trim()) {
      toast({ title: "Missing Info", description: "Provide a name and audio.", variant: "destructive" });
      return;
    }

    setIsCloning(true);
    try {
      const formData = new FormData();
      formData.append("action", "clone");
      formData.append("name", voiceName.trim());

      if (recordedBlob) {
        formData.append("audio", new File([recordedBlob], "recording.webm", { type: "audio/webm" }));
      } else if (uploadedFile) {
        formData.append("audio", uploadedFile);
      }

      const { data, error } = await supabase.functions.invoke("clone-voice", {
        body: formData,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: "Voice Cloned!", description: `"${voiceName}" is now available.` });
      setVoiceName("");
      setRecordedBlob(null);
      setUploadedFile(null);
      fetchVoices();
    } catch (err) {
      toast({
        title: "Cloning Failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("voice_id", id);

      const { data, error } = await supabase.functions.invoke("clone-voice", {
        body: formData,
      });
      if (error) throw error;
      toast({ title: "Voice Deleted" });
      fetchVoices();
    } catch {
      toast({ title: "Delete Failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const audioLabel = recordedBlob
    ? "Recording ready"
    : uploadedFile
    ? uploadedFile.name
    : null;

  const previewUrl = recordedBlob
    ? URL.createObjectURL(recordedBlob)
    : uploadedFile
    ? URL.createObjectURL(uploadedFile)
    : null;

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50 space-y-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <AudioLines className="w-4 h-4 text-primary" />
        Voice Cloning
      </h3>

      {/* Name input */}
      <Input
        placeholder="Name your voice..."
        value={voiceName}
        onChange={(e) => setVoiceName(e.target.value)}
        maxLength={50}
        className="bg-background/50 border-border/50"
      />

      {/* Record or Upload */}
      <div className="flex gap-2">
        {isRecording ? (
          <Button variant="destructive" size="sm" onClick={stopRecording} className="flex-1">
            <StopCircle className="w-4 h-4 mr-1" /> Stop Recording
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={startRecording} className="flex-1">
            <Mic className="w-4 h-4 mr-1" /> Record
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
          <Upload className="w-4 h-4 mr-1" /> Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {audioLabel && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground truncate">✅ {audioLabel}</p>
          {previewUrl && (
            <audio
              controls
              src={previewUrl}
              className="w-full h-8 [&::-webkit-media-controls-panel]:bg-muted/50 rounded"
            />
          )}
        </div>
      )}

      <Button
        onClick={handleClone}
        disabled={isCloning || (!recordedBlob && !uploadedFile) || !voiceName.trim()}
        variant="studio"
        size="sm"
        className="w-full"
      >
        {isCloning ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Cloning...</>
        ) : (
          "Clone Voice"
        )}
      </Button>

      {/* Cloned voices list */}
      {loadingVoices ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : clonedVoices.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your Cloned Voices</p>
          {clonedVoices.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
              <span className="truncate">{v.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleDelete(v.id)}
                disabled={deletingId === v.id}
              >
                {deletingId === v.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 text-destructive" />
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Record or upload clear speech audio (30+ seconds recommended). Max 10 voices.
      </p>
    </Card>
  );
}
