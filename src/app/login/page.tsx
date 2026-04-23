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
import { BookOpen, KeyRound, ArrowRight, ShieldCheck, Sparkles, GraduationCap } from 'lucide-react';
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
    <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0c10]">
      {/* Background Layer with animated depth */}
      {loginImage && (
        <div className="absolute inset-0 z-0">
          <Image
            src={loginImage.imageUrl}
            alt="Campus Background"
            fill
            className="object-cover opacity-20 scale-110 blur-[1px] animate-pulse-slow"
            priority
            data-ai-hint="college campus"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0c10] via-slate-900/60 to-primary/10" />
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-float opacity-30" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px] animate-float opacity-20 delay-1000" />
        </div>
      )}

      {/* Content Layer */}
      <div className="relative z-10 w-full max-w-6xl px-6 flex flex-col lg:flex-row gap-20 items-center">
        <div className="flex-1 text-white space-y-8 hidden lg:block">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary-foreground text-xs font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-left duration-700 backdrop-blur-md">
            <ShieldCheck className="h-3 w-3" /> Secure Academic Gateway
          </div>
          <h1 className="text-7xl font-black tracking-tighter leading-none animate-in fade-in slide-in-from-left duration-1000 delay-200">
            Elevate Your <br />
            <span className="unique-gradient-text text-glow">Experience.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-lg leading-relaxed animate-in fade-in slide-in-from-left duration-1000 delay-300">
            A high-fidelity digital ecosystem designed for students, faculty, and administrators to thrive in a unified academic environment.
          </p>
          <div className="flex items-center gap-6 pt-8 animate-in fade-in slide-in-from-left duration-1000 delay-500">
             <div className="flex -space-x-4">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-12 w-12 rounded-full border-4 border-[#0a0c10] bg-slate-800 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter ring-1 ring-white/10">CC</div>
               ))}
             </div>
             <div>
                <p className="text-sm text-slate-300 font-bold tracking-tight">Active Community</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-black">2,000+ Verified Members</p>
             </div>
          </div>
        </div>

        <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
          <Card className="glass-card border-none overflow-hidden bg-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <CardHeader className="space-y-2 pb-10 bg-gradient-to-b from-white/5 to-transparent">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-black uppercase tracking-tighter text-white">Campus Connect</span>
              </div>
              <CardTitle className="text-3xl font-black tracking-tight text-white uppercase">Welcome Back</CardTitle>
              <CardDescription className="text-slate-400 font-medium">Identify yourself to access the academic ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleLogin} className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="identifier" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Credential Index</Label>
                  <Input
                    id="identifier"
                    placeholder="Roll No. / Faculty ID / Email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isDisabled}
                    className="h-14 glass-input text-white placeholder:text-slate-600 border-white/5"
                  />
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between px-1">
                    <Label htmlFor="password" title="Keyphrase" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Keyphrase</Label>
                    <Link href="#" className="text-[10px] text-primary hover:underline font-black uppercase tracking-widest">Recovery</Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDisabled}
                    className="h-14 glass-input text-white border-white/5"
                  />
                </div>
                <Button type="submit" className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-2xl group transition-all" disabled={isDisabled}>
                  {isLoggingIn ? 'Verifying...' : 'Authorize Access'} 
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                
                <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                    <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em] font-black text-slate-600">
                        <span className="bg-transparent px-4">Institutional SSO</span>
                    </div>
                </div>
                
                <Button variant="outline" type="button" className="w-full h-14 border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl" onClick={handleGoogleLogin} disabled={isDisabled}>
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google Authentication
                </Button>
              </form>

              <div className="pt-8 border-t border-white/5 flex flex-col gap-6">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl backdrop-blur-md">
                    <div className="flex gap-3 text-[10px]">
                        <KeyRound className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="space-y-1.5">
                            <p className="font-black uppercase tracking-widest text-amber-500">Demo Simulation Access</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300 font-bold">
                                <p>Student: <code className="text-white bg-white/5 px-1.5 rounded">2024001</code></p>
                                <p>Faculty: <code className="text-white bg-white/5 px-1.5 rounded">FAC1001</code></p>
                                <p className="col-span-2">Admin: <code className="text-white bg-white/5 px-1.5 rounded">super.admin@college.edu</code></p>
                            </div>
                        </div>
                    </div>
                  </div>
                  <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                    Unregistered User?{' '}
                    <Link href="/signup" className="text-primary hover:text-indigo-400 transition-colors">Enroll Here</Link>
                  </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}