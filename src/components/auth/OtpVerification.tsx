import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

interface OtpVerificationProps {
  email: string;
  isLoading: boolean;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}

const OtpVerification = ({ email, isLoading, onVerify, onResend, onBack }: OtpVerificationProps) => {
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleVerify = async () => {
    if (otp.length === 6) {
      await onVerify(otp);
    }
  };

  const handleResend = async () => {
    await onResend();
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onBack}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        disabled={isLoading}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Mail className="w-8 h-8 text-primary" />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">Check Your Email</h3>
      <p className="text-muted-foreground text-sm mb-6">
        We sent a 6-digit code to <strong>{email}</strong>
      </p>

      <div className="flex justify-center mb-6">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={setOtp}
          disabled={isLoading}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        onClick={handleVerify}
        variant="studio"
        size="lg"
        className="w-full mb-4"
        disabled={isLoading || otp.length !== 6}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Verify Email
          </>
        )}
      </Button>

      <p className="text-sm text-muted-foreground">
        Didn't receive the code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={isLoading || resendCooldown > 0}
          className="text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
        </button>
      </p>
    </div>
  );
};

export default OtpVerification;
