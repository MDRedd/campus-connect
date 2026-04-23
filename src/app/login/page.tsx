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
        let errorMessage = 'Invalid credentials. Please check your Roll No./ID and password.';
        
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            errorMessage = 'Account not found or password incorrect. Did you sign up first?';
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
    toast({
      title: 'Redirecting to Google...',
      description: 'Please follow the prompts to sign in.',
    });
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
            <p className="text-lg">
              &ldquo;An investment in knowledge pays the best interest.&rdquo;
            </p>
            <footer className="text-sm">Benjamin Franklin</footer>
          </blockquote>
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <Card className="w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Login</CardTitle>
              <CardDescription>
                Enter your Roll Number, Faculty ID, or Email to login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="grid gap-4">
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
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDisabled}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isDisabled}>
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                </div>
                <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={isDisabled}>
                  Login with Google
                </Button>
              </form>
               <div className="mt-6 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="underline font-bold text-primary">
                  Sign up now
                </Link>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <KeyRound className="h-4 w-4" /> Sample Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm grid gap-2">
              <p>1. Student: <code className="bg-background px-1 rounded border">2024001</code></p>
              <p>2. Faculty: <code className="bg-background px-1 rounded border">FAC1001</code></p>
              <p>3. Admin: <code className="bg-background px-1 rounded border text-xs">super.admin@college.edu</code></p>
              <p className="mt-1">Password: <code className="bg-background px-1 rounded border">password123</code></p>
              <Alert variant="default" className="mt-4 bg-background border-primary/20 shadow-sm">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-bold text-xs uppercase tracking-tight">Important</AlertTitle>
                <AlertDescription className="text-[11px] leading-tight text-muted-foreground">
                  The sample IDs above are not pre-created. You <strong>must</strong> use the <Link href="/signup" className="underline font-bold text-primary">Sign up</Link> page first to register them before logging in.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
