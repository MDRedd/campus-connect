'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { BookOpen, ShieldCheck, Sparkles, GraduationCap } from 'lucide-react';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';

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
        let role: 'student' | 'faculty' | 'super-admin' = 'student'; 
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
        
        // Create user document in Firestore with Audit Flag
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userData: any = {
            id: newUser.uid,
            name: name,
            email: newUser.email,
            role: role,
            department: department,
            auditStatus: 'pending', // Identity requires verification
            joinedAt: new Date().toISOString(),
        };
        if (rollNumber) userData.rollNumber = rollNumber;
        if (facultyCode) userData.facultyCode = facultyCode;
        
        setDocumentNonBlocking(userDocRef, userData, {});

        // Notify Admins of new signup for Audit
        const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'super-admin'));
        getDocs(adminsQuery).then(snap => {
            snap.docs.forEach(adminDoc => {
                addDocumentNonBlocking(collection(firestore, 'users', adminDoc.id, 'notifications'), {
                    userId: adminDoc.id,
                    message: `IDENTITY PROVISIONING ALERT: ${name} (${role}) has requested system access. Persona audit is required.`,
                    read: false,
                    createdAt: new Date().toISOString(),
                    link: '/users',
                });
            });
        }).catch(err => console.error("Admin notification sync failure:", err));

        toast({
            title: 'Provisioning Successful',
            description: 'Your identity has been queued for institutional audit. Redirecting...',
        });
    } catch (error: any) {
        console.error("Error signing up:", error);
        toast({
            variant: 'destructive',
            title: 'Provisioning Failed',
            description: error.code === 'auth/email-already-in-use' ? 'This identity is already registered.' : 'An unexpected protocol exception occurred.',
        });
    } finally {
        setIsSigningUp(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0c10]">
      {loginImage && (
        <div className="absolute inset-0 z-0">
          <Image src={loginImage.imageUrl} alt="Signup" fill className="object-cover opacity-20 scale-110 blur-[1px] animate-pulse-slow" priority data-ai-hint="college campus" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0c10] via-slate-900/60 to-primary/10" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-md px-6">
          <Card className="glass-card border-none overflow-hidden bg-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <CardHeader className="space-y-2 pb-10 bg-gradient-to-b from-white/5 to-transparent">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-black uppercase tracking-tighter text-white">Campus Connect</span>
              </div>
              <CardTitle className="text-3xl font-black tracking-tight text-white uppercase">New Identity</CardTitle>
              <CardDescription className="text-slate-400 font-medium">Initialize your digital persona in the college ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSignUp} className="grid gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Legal Name</Label>
                    <Input id="name" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={isUserLoading || isSigningUp} className="h-14 glass-input text-white placeholder:text-slate-600 border-white/5" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Institutional Email</Label>
                  <Input id="email" type="email" placeholder="e.g., 2024001@student.college.edu" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isUserLoading || isSigningUp} className="h-14 glass-input text-white placeholder:text-slate-600 border-white/5" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" title="Keyphrase" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Secure Keyphrase</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isUserLoading || isSigningUp} className="h-14 glass-input text-white border-white/5" />
                </div>
                <Button type="submit" className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-2xl group transition-all" disabled={isUserLoading || isSigningUp}>
                  {isSigningUp ? 'Provisioning...' : 'Provision Identity'} 
                </Button>
              </form>
              <div className="mt-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Already registered?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Authorize Access
                </Link>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
