import { useState, useRef, useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 500);
    };

    video.addEventListener("ended", handleEnded);
    
    // Auto-play video with sound
    video.play().catch((err) => {
      console.log("Autoplay blocked, completing splash:", err);
      // If autoplay is blocked, skip splash after a brief moment
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setIsVisible(false);
          onComplete();
        }, 500);
      }, 1000);
    });

    return () => {
      video.removeEventListener("ended", handleEnded);
    };
  }, [onComplete]);

  // Handle click to skip intro
  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleSkip}
    >
      <video
        ref={videoRef}
        className="max-w-full max-h-full object-contain"
        muted={false}
        playsInline
        preload="auto"
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        Skip
      </button>
    </div>
  );
};

export default SplashScreen;
