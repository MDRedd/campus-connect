'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { BookOpen } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const loginImage = PlaceHolderImages.find((img) => img.id === 'login-image');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
    // If identifier doesn't contain '@', append domain based on simple rules
    if (!identifier.includes('@')) {
      if (/^\d+$/.test(identifier)) { // All digits -> student
        email = `${identifier}@student.college.edu`;
      } else if (/^[a-zA-Z]+\d*$/.test(identifier)) { // Starts with letters, might end with digits -> faculty
        email = `${identifier}@faculty.college.edu`;
      } else { // Fallback for other usernames, potentially admins
        email = `${identifier}@college.edu`;
      }
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({
          title: 'Logged In!',
          description: 'Redirecting to your dashboard...',
        });
    } catch (error) {
        console.error("Login Error. Identifier:", identifier, "Attempted Email:", email, "Error:", error);
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Invalid credentials. Please check your details and try again.',
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
            data-ai-hint={loginImage.imageHint}
          />
        )}
        <div className="relative z-20 flex items-center text-lg font-medium">
          <BookOpen className="mr-2 h-6 w-6" />
          CampusConnect
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
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">Login</CardTitle>
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
                    disabled={isLoggingIn || isUserLoading}
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
                    disabled={isLoggingIn || isUserLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoggingIn || isUserLoading}>
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Button>
                <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={isLoggingIn || isUserLoading}>
                  Login with Google
                </Button>
              </form>
               <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="underline">
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
