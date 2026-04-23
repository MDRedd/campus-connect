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
import { BookOpen, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-primary/80" />
        {loginImage && (
          <Image
            src={loginImage.imageUrl}
            alt={loginImage.description}
            fill
            className="object-cover"
            priority
            data-ai-hint={loginImage.imageHint}
          />
        )}
        <div className="relative z-20 flex items-center text-lg font-medium">
          <BookOpen className="mr-2 h-6 w-6" />
          Campus Connect
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg italic">&ldquo;An investment in knowledge pays the best interest.&rdquo;</p>
            <footer className="text-sm font-semibold">— Benjamin Franklin</footer>
          </blockquote>
        </div>
      </div>
      <div className="flex items-center justify-center py-12 px-4">
        <div className="mx-auto grid w-full max-w-sm gap-6">
          <Card className="w-full shadow-2xl border-primary/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-3xl font-bold tracking-tight">Login</CardTitle>
              <CardDescription>Enter your Roll No, Faculty ID, or Email to sign in.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="identifier">Roll No. / Faculty ID / Email</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="e.g., 2024001 or FAC1001"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isDisabled}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="#" className="text-xs text-primary hover:underline font-medium">Forgot password?</Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDisabled}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isDisabled}>
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-medium">Or</span></div>
                </div>
                <Button variant="outline" type="button" className="w-full h-11" onClick={handleGoogleLogin} disabled={isDisabled}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </Button>
              </form>
               <div className="mt-8 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="underline font-bold text-primary">Sign up now</Link>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-primary font-bold">
                <KeyRound className="h-4 w-4" /> Sample Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm grid gap-3">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Student: <code className="bg-background px-1 font-mono">2024001</code></p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Faculty: <code className="bg-background px-1 font-mono">FAC1001</code></p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Password: <code className="bg-background px-1 font-mono">password123</code></p>
              </div>
              <Alert variant="default" className="mt-2 bg-background/50 py-2">
                <AlertCircle className="h-3 w-3 text-primary" />
                <AlertDescription className="text-[10px] leading-tight text-muted-foreground">
                  Register these on the <Link href="/signup" className="underline font-bold">Sign up</Link> page first.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
