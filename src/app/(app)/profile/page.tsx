'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Save, ShieldCheck, GraduationCap, Building2, Fingerprint, Sparkles } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  department: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      department: '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        name: userProfile.name || '',
        department: userProfile.department || '',
      });
    }
  }, [userProfile, form]);

  const userInitials = userProfile?.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  const onSubmit = (data: ProfileFormValues) => {
    if (!userDocRef) return;
    
    updateDocumentNonBlocking(userDocRef, {
      name: data.name,
      department: data.department,
    });

    toast({
      title: 'Ledger Updated',
      description: 'Your institutional identity has been successfully synchronized.',
    });
    setIsEditing(false);
  };

  if (isUserLoading) {
    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
             <div className="academic-hero h-64"><Skeleton className="h-full w-full rounded-[3rem] opacity-20" /></div>
             <Skeleton className="h-96 w-full rounded-[2.5rem]" />
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
        <div className="academic-hero">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                        <Fingerprint className="h-3 w-3" /> Identity Node
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">VIRTUAL PERSONA</h1>
                    <p className="text-indigo-100/70 font-medium max-w-lg">Manage your institutional identity profile and synchronization parameters.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status Index</span>
                    <span className="text-2xl font-black tracking-tighter uppercase">{userProfile?.auditStatus === 'verified' ? 'Verified' : 'Pending Audit'}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase">Tier: {userProfile?.role}</span>
                </div>
            </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-4 glass-card border-none overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-white/10 p-8">
                    <div className="flex flex-col items-center gap-6">
                        <Avatar className="h-40 w-40 border-4 border-white shadow-2xl ring-1 ring-indigo-50">
                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={userProfile?.name} />}
                            <AvatarFallback className="text-4xl font-black text-primary bg-primary/5">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div className="text-center space-y-1">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">{userProfile?.name}</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2">
                                <ShieldCheck className="h-3 w-3" /> {userProfile?.role.replace('-', ' ')}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-indigo-50/50">
                            <div className="bg-primary/5 p-2 rounded-lg text-primary"><GraduationCap className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Institutional Email</p>
                                <p className="text-xs font-bold text-slate-700 truncate">{userProfile?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-indigo-50/50">
                            <div className="bg-accent/5 p-2 rounded-lg text-accent"><Building2 className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Departmental Hub</p>
                                <p className="text-xs font-bold text-slate-700 truncate">{userProfile?.department || 'Undeclared'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-8 glass-card border-none overflow-hidden">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                        <CardHeader className="bg-white/40 border-b border-white/20 p-8">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-black uppercase tracking-tight">Ledger Metadata</CardTitle>
                                {!isEditing && (
                                    <Button type="button" onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 border-indigo-100">
                                        <Pencil className="mr-2 h-4 w-4" /> Edit Record
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow p-10 space-y-8">
                            <div className="grid gap-8">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Legal Persona Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled={!isEditing} className="h-14 glass-input border-none shadow-inner text-lg font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="department"
                                    render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Department</FormLabel>
                                        <FormControl>
                                            <Input {...field} disabled={!isEditing} placeholder="e.g. Computer Science Engineering" className="h-14 glass-input border-none shadow-inner font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                        {isEditing && (
                            <CardFooter className="bg-slate-50/50 p-8 border-t border-indigo-50/50 flex justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest">Abort Changes</Button>
                                <Button type="submit" className="rounded-xl h-12 px-10 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                    <Save className="mr-2 h-4 w-4" /> Synchronize Identity
                                </Button>
                            </CardFooter>
                        )}
                    </form>
                </Form>
            </Card>
        </div>
    </div>
  );
}