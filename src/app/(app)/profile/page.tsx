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
import { Pencil, Save, ShieldCheck, GraduationCap, Building2, Fingerprint, Sparkles, QrCode } from 'lucide-react';
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
    .map((n: string) => n[0])
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

  const isVerified = userProfile?.auditStatus === 'verified';

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
                    <span className="text-2xl font-black tracking-tighter uppercase">{isVerified ? 'Verified' : 'Pending Audit'}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase">Tier: {userProfile?.role}</span>
                </div>
            </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-8">
                {/* Cinematic Digital ID Card */}
                <Card className="relative overflow-hidden group border-none shadow-2xl rounded-[2.5rem] bg-[#0d1117] text-white p-1">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 opacity-50" />
                    <div className={cn("relative z-10 p-8 rounded-[2.3rem] border-2 border-white/5", isVerified ? "bg-gradient-to-br from-slate-900 to-[#0a0c10]" : "bg-slate-900/50 grayscale")}>
                        <div className="flex justify-between items-start mb-10">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-primary rounded-lg"><GraduationCap className="h-4 w-4" /></div>
                                    <span className="text-xs font-black uppercase tracking-[0.3em]">CAMPUS CONNECT</span>
                                </div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-10">Institutional Digital Ledger</p>
                            </div>
                            <div className="text-right">
                                <Badge className={cn("rounded-lg font-black uppercase text-[8px] tracking-widest", isVerified ? "bg-green-500" : "bg-amber-500 animate-pulse")}>
                                    {isVerified ? "IDENTITY VERIFIED" : "AUDIT PENDING"}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-8 mb-10">
                            <div className="relative">
                                <Avatar className="h-32 w-32 border-4 border-white/10 shadow-2xl ring-4 ring-primary/20">
                                    {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={userProfile?.name} />}
                                    <AvatarFallback className="text-4xl font-black text-primary bg-white/5">{userInitials}</AvatarFallback>
                                </Avatar>
                                {isVerified && <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-[#0d1117] shadow-lg"><ShieldCheck className="h-5 w-5 text-white" /></div>}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Persona Name</p>
                                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none">{userProfile?.name}</h2>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assigned Role</p>
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{userProfile?.role.replace('-', ' ')} Tier</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/5">
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Department</p>
                                <p className="text-[10px] font-bold uppercase truncate">{userProfile?.department || 'Not Aligned'}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Credential Index</p>
                                <p className="text-[10px] font-bold uppercase font-mono">{userProfile?.id.substring(0, 12)}...</p>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="flex gap-1 h-8 opacity-20">
                                {[...Array(20)].map((_, i) => <div key={i} className="w-1 bg-white h-full" style={{ opacity: Math.random() }} />)}
                            </div>
                            <div className="bg-white p-1 rounded-md opacity-20"><QrCode className="h-8 w-8 text-black" /></div>
                        </div>
                    </div>
                </Card>

                <Card className="glass-card border-none bg-indigo-50/50 p-8 space-y-6">
                    <CardHeader className="p-0"><CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Metadata Registry</CardTitle></CardHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-indigo-50 shadow-sm">
                            <div className="bg-primary/5 p-2 rounded-lg text-primary"><Sparkles className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Communication Channel</p>
                                <p className="text-xs font-bold text-slate-700 truncate">{userProfile?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-indigo-50 shadow-sm">
                            <div className="bg-accent/5 p-2 rounded-lg text-accent"><Building2 className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Access Node</p>
                                <p className="text-xs font-bold text-slate-700 truncate">Regional Campus v2.0</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="lg:col-span-7 glass-card border-none overflow-hidden">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
                        <CardHeader className="bg-white/40 border-b border-white/20 p-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tight">Identity Modification Terminal</CardTitle>
                                    <CardDescription className="text-xs font-medium">Update your institutional ledger records.</CardDescription>
                                </div>
                                {!isEditing && (
                                    <Button type="button" onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 border-indigo-100">
                                        <Pencil className="mr-2 h-4 w-4" /> Edit Ledger
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow p-10 space-y-10">
                            <div className="grid gap-10">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                    <FormItem className="space-y-3">
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
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Academic Departmental Alignment</FormLabel>
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
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest">Abort protocol</Button>
                                <Button type="submit" className="rounded-xl h-12 px-10 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                    <Save className="mr-2 h-4 w-4" /> Finalize Modification
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