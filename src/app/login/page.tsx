'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { BookOpen, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginImage = PlaceHolderImages.find((img) => img.id === 'login-image');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoggingIn(true);

    let email = identifier;
    if (!identifier.includes('@')) {
      if (/^\d+$/.test(identifier)) {
        email = `${identifier}@student.college.edu`;
      } else if (/^[a-zA-Z]+\d*$/.test(identifier)) {
        email = `${identifier}@faculty.college.edu`;
      } else {
        email = `${identifier}@college.edu`;
      }
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        let errorMessage = 'Invalid credentials. Please check your credentials and try again.';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            errorMessage = 'Account not found or password incorrect. Please ensure you have signed up first.';
        }
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: errorMessage,
        });
    } finally {
        setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!auth) return;
    initiateGoogleSignIn(auth);
    toast({ title: 'Redirecting to Google...' });
  };

  const isDisabled = !mounted || isLoggingIn || isUserLoading;

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Background Layer */}
      {loginImage && (
        <div className="absolute inset-0 z-0">
          <Image
            src={loginImage.imageUrl}
            alt="Campus Background"
            fill
            className="object-cover opacity-30 scale-105 blur-[2px]"
            priority
            data-ai-hint="college campus"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/80 to-primary/20" />
        </div>
      )}

      {/* Content Layer */}
      <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col lg:flex-row gap-12 items-center">
        <div className="flex-1 text-white space-y-6 hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground text-sm font-medium animate-in fade-in slide-in-from-left duration-700">
            <ShieldCheck className="h-4 w-4" /> Secure Academic Gateway
          </div>
          <h1 className="text-6xl font-bold tracking-tighter leading-tight animate-in fade-in slide-in-from-left duration-1000 delay-200">
            Elevate Your <br />
            <span className="unique-gradient-text">Campus Experience.</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-md animate-in fade-in slide-in-from-left duration-1000 delay-300">
            A unified digital ecosystem for students, faculty, and administrators to thrive together.
          </p>
          <div className="flex items-center gap-4 pt-4 animate-in fade-in slide-in-from-left duration-1000 delay-500">
             <div className="flex -space-x-3">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-10 w-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-xs font-bold">CC</div>
               ))}
             </div>
             <p className="text-sm text-slate-400 font-medium italic">Join 2,000+ students and faculty members</p>
          </div>
        </div>

        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <Card className="glass-card border-0">
            <CardHeader className="space-y-1 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary p-2 rounded-xl">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">Campus Connect</span>
              </div>
              <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
              <CardDescription className="text-slate-500">Enter your institutional credentials to access your dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleLogin} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="identifier">Roll No. / Faculty ID / Email</Label>
                  <Input
                    id="identifier"
                    placeholder="e.g., 2024001 or FAC1001"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isDisabled}
                    className="h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="#" className="text-xs text-primary hover:underline font-semibold">Forgot password?</Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDisabled}
                    className="h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200"
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" disabled={isDisabled}>
                  {isLoggingIn ? 'Authenticating...' : 'Sign In'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-950 px-2 text-slate-400 font-medium">Institutional Access</span></div>
                </div>
                <Button variant="outline" type="button" className="w-full h-12 border-slate-200 hover:bg-slate-50" onClick={handleGoogleLogin} disabled={isDisabled}>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google SSO
                </Button>
              </form>

              <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                  <Card className="bg-amber-50/50 border-amber-100 p-3">
                    <div className="flex gap-2 text-xs">
                        <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                        <div>
                            <p className="font-bold text-amber-900 mb-1">Quick Demo Access</p>
                            <div className="space-y-0.5 text-amber-800">
                                <p>Student ID: <code className="bg-white px-1">2024001</code></p>
                                <p>Faculty ID: <code className="bg-white px-1">FAC1001</code></p>
                                <p>Admin: <code className="bg-white px-1">super.admin@college.edu</code></p>
                            </div>
                        </div>
                    </div>
                  </Card>
                  <p className="text-center text-sm font-medium text-slate-500">
                    New to the platform?{' '}
                    <Link href="/signup" className="text-primary hover:underline font-bold">Create an account</Link>
                  </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}