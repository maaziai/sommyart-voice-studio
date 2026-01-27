import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, Lock, Mic, KeyRound, ArrowLeft } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

interface AuthFormProps {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  errors: { email?: string; password?: string; confirmPassword?: string };
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchMode: (mode: AuthMode) => void;
}

const AuthForm = ({
  mode,
  email,
  password,
  confirmPassword,
  errors,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchMode,
}: AuthFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {(mode === 'forgot' || mode === 'reset') && (
        <button
          type="button"
          onClick={() => onSwitchMode('login')}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Email
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={`bg-background/50 ${errors.email ? 'border-destructive' : 'border-border/50'}`}
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>
      )}

      {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {mode === 'reset' ? 'New Password' : 'Password'}
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`bg-background/50 ${errors.password ? 'border-destructive' : 'border-border/50'}`}
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>
      )}

      {mode === 'reset' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Confirm Password
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            className={`bg-background/50 ${errors.confirmPassword ? 'border-destructive' : 'border-border/50'}`}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>
      )}

      {mode === 'login' && (
        <div className="text-right">
          <button
            type="button"
            onClick={() => onSwitchMode('forgot')}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            disabled={isLoading}
          >
            Forgot password?
          </button>
        </div>
      )}

      <Button
        type="submit"
        variant="studio"
        size="lg"
        className="w-full mt-6"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {mode === 'login' && 'Signing in...'}
            {mode === 'signup' && 'Creating account...'}
            {mode === 'forgot' && 'Sending reset link...'}
            {mode === 'reset' && 'Updating password...'}
          </>
        ) : (
          <>
            {mode === 'reset' ? <KeyRound className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Send Reset Link'}
            {mode === 'reset' && 'Update Password'}
          </>
        )}
      </Button>

      {(mode === 'login' || mode === 'signup') && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => onSwitchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary hover:underline font-medium"
              disabled={isLoading}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      )}
    </form>
  );
};

export default AuthForm;
