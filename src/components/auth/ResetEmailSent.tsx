import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface ResetEmailSentProps {
  email: string;
  onBackToLogin: () => void;
}

const ResetEmailSent = ({ email, onBackToLogin }: ResetEmailSentProps) => {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Mail className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Check Your Email</h3>
      <p className="text-muted-foreground text-sm mb-6">
        We sent a password reset link to <strong>{email}</strong>. 
        Click the link in the email to reset your password.
      </p>
      <Button
        variant="outline"
        onClick={onBackToLogin}
        className="w-full"
      >
        Back to Sign In
      </Button>
    </div>
  );
};

export default ResetEmailSent;
