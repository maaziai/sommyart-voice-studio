import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import sommyartLogo from '@/assets/sommyart-logo.jpg';
import AuthForm from '@/components/auth/AuthForm';
import OtpVerification from '@/components/auth/OtpVerification';
import ResetEmailSent from '@/components/auth/ResetEmailSent';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import AppleSignInButton from '@/components/auth/AppleSignInButton';

// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  
  const { user, loading, signIn, resetPasswordForEmail, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for reset mode from URL
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'reset' && session) {
      setMode('reset');
    }
  }, [searchParams, session]);

  // Redirect if already logged in (except for reset mode)
  useEffect(() => {
    if (!loading && user && mode !== 'reset') {
      navigate('/studio');
    }
  }, [user, loading, navigate, mode]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string } = {};
    
    if (mode === 'login' || mode === 'signup' || mode === 'forgot') {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    }
    
    if (mode === 'login' || mode === 'signup') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    if (mode === 'reset') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Login Failed',
              description: 'Invalid email or password. Please try again.',
              variant: 'destructive',
            });
          } else if (error.message.includes('Email not confirmed')) {
            // User hasn't verified their email yet, show OTP verification
            setPendingEmail(email);
            setPendingPassword(password);
            setShowOtpVerification(true);
            // Resend OTP
            await supabase.auth.resend({
              type: 'signup',
              email: email,
            });
            toast({
              title: 'Email Not Verified',
              description: 'Please verify your email. We sent a new code.',
            });
          } else {
            toast({
              title: 'Login Failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Welcome Back!',
            description: 'You have successfully logged in.',
          });
          navigate('/studio');
        }
      } else if (mode === 'signup') {
        // Sign up with email - will send OTP
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            toast({
              title: 'Account Exists',
              description: 'An account with this email already exists. Please log in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign Up Failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else if (data.user && !data.session) {
          // User created but needs email verification
          setPendingEmail(email);
          setPendingPassword(password);
          setShowOtpVerification(true);
          toast({
            title: 'Verification Code Sent',
            description: 'Please check your email for the 6-digit code.',
          });
        } else if (data.session) {
          // Auto-confirmed (shouldn't happen with our settings, but handle it)
          toast({
            title: 'Account Created!',
            description: 'Welcome to Sommyart Labs!',
          });
          navigate('/studio');
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPasswordForEmail(email);
        if (error) {
          toast({
            title: 'Reset Failed',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          setResetEmailSent(true);
          toast({
            title: 'Check Your Email',
            description: 'We sent you a password reset link.',
          });
        }
      } else if (mode === 'reset') {
        const { error } = await updatePassword(password);
        if (error) {
          toast({
            title: 'Password Update Failed',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Password Updated!',
            description: 'Your password has been successfully changed.',
          });
          navigate('/studio');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (otp: string) => {
    setIsLoading(true);
    try {
      const { error, data } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: 'signup',
      });

      if (error) {
        toast({
          title: 'Verification Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data.session) {
        toast({
          title: 'Email Verified!',
          description: 'Welcome to Sommyart Labs!',
        });
        navigate('/studio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
      });

      if (error) {
        toast({
          title: 'Resend Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Code Sent',
          description: 'A new verification code has been sent to your email.',
        });
      }
    } catch (err) {
      toast({
        title: 'Resend Failed',
        description: 'Unable to resend code. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBackFromOtp = () => {
    setShowOtpVerification(false);
    setPendingEmail('');
    setPendingPassword('');
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setResetEmailSent(false);
    setShowOtpVerification(false);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTitle = () => {
    if (showOtpVerification) return 'Verify Your Email';
    switch (mode) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Reset Password';
      case 'reset': return 'Set New Password';
    }
  };

  const getSubtitle = () => {
    if (showOtpVerification) return 'Enter the code we sent to your email';
    switch (mode) {
      case 'login': return 'Sign in to access your voice studio';
      case 'signup': return 'Sign up to start generating AI voices';
      case 'forgot': return "Enter your email and we'll send you a reset link";
      case 'reset': return 'Choose a strong new password';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="relative w-full max-w-md p-8 bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
        <div className="text-center mb-8">
          <img 
            src={sommyartLogo} 
            alt="Sommyart Labs Logo" 
            className="w-16 h-16 mx-auto rounded-xl shadow-lg mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {getTitle()}
          </h1>
          <p className="text-muted-foreground text-sm">
            {getSubtitle()}
          </p>
        </div>

        {showOtpVerification ? (
          <OtpVerification
            email={pendingEmail}
            isLoading={isLoading}
            onVerify={handleOtpVerify}
            onResend={handleResendOtp}
            onBack={handleBackFromOtp}
          />
        ) : mode === 'forgot' && resetEmailSent ? (
          <ResetEmailSent
            email={email}
            onBackToLogin={() => switchMode('login')}
          />
        ) : (
          <>
            <AuthForm
              mode={mode}
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              errors={errors}
              isLoading={isLoading}
              onEmailChange={handleEmailChange}
              onPasswordChange={handlePasswordChange}
              onConfirmPasswordChange={handleConfirmPasswordChange}
              onSubmit={handleSubmit}
              onSwitchMode={switchMode}
            />
            
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <GoogleSignInButton />
                  <AppleSignInButton />
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default Auth;
