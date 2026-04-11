import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users } from "lucide-react";

export interface Speaker {
  id: string;
  name: string;
  voice: string;
}

export const availableVoices = [
  { value: "Kore", label: "Kore (Female)" },
  { value: "Puck", label: "Puck (Male)" },
  { value: "Charon", label: "Charon (Male Deep)" },
  { value: "Fenrir", label: "Fenrir (Male Bold)" },
  { value: "Aoede", label: "Aoede (Female Warm)" },
  { value: "Leda", label: "Leda (Female Soft)" },
  { value: "Orus", label: "Orus (Male Calm)" },
  { value: "Zephyr", label: "Zephyr (Neutral)" },
];

interface SpeakerConfigProps {
  speakers: Speaker[];
  onSpeakersChange: (speakers: Speaker[]) => void;
  isMultiSpeaker: boolean;
  onMultiSpeakerChange: (enabled: boolean) => void;
}

export const SpeakerConfig = ({ 
  speakers, 
  onSpeakersChange, 
  isMultiSpeaker, 
  onMultiSpeakerChange 
}: SpeakerConfigProps) => {
  const addSpeaker = () => {
    const newSpeaker: Speaker = {
      id: crypto.randomUUID(),
      name: `Speaker ${speakers.length + 1}`,
      voice: availableVoices[speakers.length % availableVoices.length].value,
    };
    onSpeakersChange([...speakers, newSpeaker]);
  };

  const removeSpeaker = (id: string) => {
    if (speakers.length > 2) {
      onSpeakersChange(speakers.filter(s => s.id !== id));
    }
  };

  const updateSpeaker = (id: string, updates: Partial<Speaker>) => {
    onSpeakersChange(
      speakers.map(s => s.id === id ? { ...s, ...updates } : s)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Multi-Speaker Mode
        </label>
        <Button
          variant={isMultiSpeaker ? "default" : "outline"}
          size="sm"
          onClick={() => onMultiSpeakerChange(!isMultiSpeaker)}
        >
          {isMultiSpeaker ? "Enabled" : "Disabled"}
        </Button>
      </div>

      {isMultiSpeaker && (
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground mb-3">
            Format your text with speaker names followed by a colon, e.g., "John: Hello there!"
          </p>
          
          {speakers.map((speaker, index) => (
            <div key={speaker.id} className="flex items-center gap-2">
              <Input
                value={speaker.name}
                onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
                placeholder="Speaker name"
                className="flex-1 bg-background/50"
              />
              <Select 
                value={speaker.voice} 
                onValueChange={(value) => updateSpeaker(speaker.id, { voice: value })}
              >
                <SelectTrigger className="w-[140px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSpeaker(speaker.id)}
                disabled={speakers.length <= 2}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addSpeaker}
            className="w-full mt-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Speaker
          </Button>
        </div>
      )}
    </div>
  );
};
