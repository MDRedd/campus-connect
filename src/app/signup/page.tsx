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
import { useAuth, useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';

export default function SignUpPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const loginImage = PlaceHolderImages.find((img) => img.id === 'login-image');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    if (password.length < 6) {
        toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters.' });
        return;
    }
    setIsSigningUp(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        // Update profile display name
        await updateProfile(newUser, { displayName: name });

        // Determine role and other details from email
        let role: 'student' | 'faculty' | 'super-admin' = 'student'; // Default role
        let department = 'Undeclared';
        let rollNumber: string | undefined = undefined;
        let facultyCode: string | undefined = undefined;
        
        const emailParts = email.split('@');
        const usernamePart = emailParts[0];
        const domainPart = emailParts.length > 1 ? emailParts[1] : '';

        if (domainPart === 'student.college.edu') {
          role = 'student';
          department = 'Undeclared';
          rollNumber = usernamePart;
        } else if (domainPart === 'faculty.college.edu') {
          role = 'faculty';
          department = 'General';
          facultyCode = usernamePart;
        } else if (email === 'super.admin@college.edu') {
          role = 'super-admin';
          department = 'Administration';
        }
        
        // Create user document in Firestore.
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userData: any = {
            id: newUser.uid,
            name: name,
            email: newUser.email,
            role: role,
            department: department,
        };
        if (rollNumber) userData.rollNumber = rollNumber;
        if (facultyCode) userData.facultyCode = facultyCode;
        
        setDocumentNonBlocking(userDocRef, userData, {});

        toast({
            title: 'Account Created',
            description: 'Welcome! You are now being redirected to your dashboard.',
        });
        // The onAuthStateChanged listener in FirebaseProvider will now detect the new user
        // and handle the redirect to the dashboard.
    } catch (error: any) {
        console.error("Error signing up:", error);
        toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: error.code === 'auth/email-already-in-use' ? 'This email is already registered.' : 'An unexpected error occurred.',
        });
    } finally {
        setIsSigningUp(false);
    }
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
          DigiCampus
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
              <CardTitle className="text-2xl">Create an account</CardTitle>
              <CardDescription>
                Enter your information to create your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={isUserLoading || isSigningUp} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="e.g., 2024001@student.college.edu" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isUserLoading || isSigningUp} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isUserLoading || isSigningUp} />
                </div>
                <Button type="submit" className="w-full" disabled={isUserLoading || isSigningUp}>
                  {isSigningUp ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                Already have an account?{' '}
                <Link href="/login" className="underline">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
