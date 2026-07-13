import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import sommyartLogo from "@/assets/sommyart-logo.jpg";

const STORAGE_KEY = "sommyart-install-prompt-shown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Already installed / running standalone — never prompt
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    if (standalone) {
      localStorage.setItem(STORAGE_KEY, "1");
      return;
    }

    // iOS Safari has no beforeinstallprompt — show instructions instead
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      // @ts-expect-error legacy
      !window.MSStream;
    if (ios) {
      setIsIOS(true);
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const markShown = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const install = async () => {
    if (!event) return markShown();
    try {
      await event.prompt();
      await event.userChoice;
    } catch (_) {
      /* ignore */
    }
    markShown();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) markShown();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <img
              src={sommyartLogo}
              alt="Sommyart Labs"
              className="w-16 h-16 rounded-xl shadow-md"
            />
          </div>
          <DialogTitle className="text-center">Install Sommyart Labs</DialogTitle>
          <DialogDescription className="text-center">
            {isIOS
              ? "Tap the Share icon in Safari, then choose 'Add to Home Screen' to install Sommyart Labs."
              : "Install Sommyart Labs on your device for a faster, full-screen experience — works offline too."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={markShown}>
            Not now
          </Button>
          {!isIOS && (
            <Button onClick={install} variant="studio">
              <Download className="w-4 h-4" />
              Install
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstallPrompt;
