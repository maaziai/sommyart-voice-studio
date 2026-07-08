import { useState, useEffect } from "react";
import sommyartLogo from "@/assets/sommyart-logo.jpg";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(onComplete, 500);
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(onComplete, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleSkip}
    >
      <img
        src={sommyartLogo}
        alt="Sommyart Labs Logo"
        className="w-32 h-32 md:w-40 md:h-40 rounded-2xl shadow-lg animate-fade-in"
      />
    </div>
  );
};

export default SplashScreen;
