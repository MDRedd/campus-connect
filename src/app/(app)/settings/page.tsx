'use client'

import { useUser, useFirestore, useMemoFirebase, useAuth, updateDocumentNonBlocking } from '@/firebase'
import { doc } from 'firebase/firestore'
import { updatePassword, deleteUser } from 'firebase/auth'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useTheme } from 'next-themes'
import { Bell, ShieldCheck, Palette, KeyRound, UserX, Sparkles, Globe, Sun, Moon, Laptop } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme()
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);

  const handlePreferenceChange = (key: string, value: boolean) => {
    if (!userDocRef) return;
    
    updateDocumentNonBlocking(userDocRef, {
      [`notificationPreferences.${key}`]: value,
    });

    toast({
      title: 'Protocol Saved',
      description: 'Your notification transmission parameters have been synchronized.',
    });
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
        toast({ variant: 'destructive', title: 'Data Missing', description: 'Please fill in both keyphrase fields.' });
        return;
    }
    if (password !== confirmPassword) {
        toast({ variant: 'destructive', title: 'Protocol Mismatch', description: 'Security keyphrases do not match.' });
        return;
    }
    if (password.length < 6) {
        toast({ variant: 'destructive', title: 'Security Error', description: 'Keyphrase must be at least 6 characters.' });
        return;
    }
    if (!authUser) return;

    setIsUpdatingPassword(true);
    try {
        await updatePassword(authUser, password);
        toast({ title: 'Success', description: 'Your security keyphrase has been rotated.' });
        setPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Session expired or invalid. Please re-authenticate.' });
    } finally {
        setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser) return;
    setIsDeletingAccount(true);
    try {
        await deleteUser(authUser);
        toast({ title: 'Account Excised', description: 'Your institutional identity has been permanently removed.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Deletion Blocked', description: 'Security protocol requires fresh authentication for this action.' });
        setIsDeletingAccount(false);
    }
  };

  if (isUserLoading) {
    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
             <div className="academic-hero h-64"><Skeleton className="h-full w-full rounded-[3rem] opacity-20" /></div>
             <div className="grid gap-6 md:grid-cols-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)}
             </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <ShieldCheck className="h-3 w-3" /> User Preferences
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">SYSTEM SETTINGS</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">Synchronize your workspace environment and manage institutional security protocols.</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Identity Status</span>
                  <span className="text-3xl font-black tracking-tighter uppercase">Authorized</span>
                  <span className="text-[9px] font-bold opacity-60 uppercase">Tier: {userProfile?.role}</span>
              </div>
          </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
          {/* Notification Block */}
          <Card className="glass-card border-none overflow-hidden">
            <CardHeader className="bg-white/40 border-b border-white/20">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" /> Transmission Preferences
                </CardTitle>
                <CardDescription className="text-xs font-medium">Configure how you receive institutional alerts and updates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-indigo-50/50 hover:bg-white transition-all">
                <div className="space-y-0.5"><Label className="text-sm font-black uppercase text-slate-800">Email Dispatch</Label><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Primary Inbox Delivery</p></div>
                <Switch checked={userProfile?.notificationPreferences?.email ?? true} onCheckedChange={(c) => handlePreferenceChange('email', c)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-indigo-50/50 hover:bg-white transition-all">
                <div className="space-y-0.5"><Label className="text-sm font-black uppercase text-slate-800">Push Notifications</Label><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">System HUD Alerts</p></div>
                <Switch checked={userProfile?.notificationPreferences?.push ?? false} onCheckedChange={(c) => handlePreferenceChange('push', c)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-indigo-50/50 hover:bg-white transition-all">
                <div className="space-y-0.5"><Label className="text-sm font-black uppercase text-slate-800">Academic Updates</Label><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">New Grades & Assessment Alerts</p></div>
                <Switch checked={userProfile?.notificationPreferences?.newGrades ?? true} onCheckedChange={(c) => handlePreferenceChange('newGrades', c)} />
              </div>
            </CardContent>
          </Card>

          {/* Theme Block */}
          <Card className="glass-card border-none overflow-hidden">
            <CardHeader className="bg-white/40 border-b border-white/20">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <Palette className="h-5 w-5 text-accent" /> UI Synchronization
                </CardTitle>
                <CardDescription className="text-xs font-medium">Select the visual modality for your workspace HUD.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 pt-8">
                {[
                    { val: 'light', icon: Sun, label: 'Light' },
                    { val: 'dark', icon: Moon, label: 'Dark' },
                    { val: 'system', icon: Laptop, label: 'Auto' }
                ].map((t) => (
                    <Button 
                        key={t.val} 
                        variant={theme === t.val ? 'default' : 'outline'} 
                        className={cn("h-32 flex-col gap-3 rounded-2xl transition-all duration-500", theme === t.val ? "shadow-xl shadow-primary/20 scale-[1.02]" : "bg-white/40")}
                        onClick={() => setTheme(t.val)}
                    >
                        <t.icon className={cn("h-8 w-8", theme === t.val ? "animate-pulse" : "opacity-40")} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.label}</span>
                    </Button>
                ))}
            </CardContent>
          </Card>

          {/* Security Block */}
          <Card className="glass-card border-none overflow-hidden">
            <CardHeader className="bg-white/40 border-b border-white/20">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-amber-500" /> Security Rotation
                </CardTitle>
                <CardDescription className="text-xs font-medium">Rotate your institutional access keyphrase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Keyphrase</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isUpdatingPassword} className="h-12 rounded-xl bg-white/50 border-none shadow-inner" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm Protocol</Label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isUpdatingPassword} className="h-12 rounded-xl bg-white/50 border-none shadow-inner" />
                </div>
                <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !password} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                    {isUpdatingPassword ? 'Syncing Keyphrase...' : 'Rotate Security Key'}
                </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="glass-card border-none overflow-hidden bg-destructive/5">
            <CardHeader className="bg-destructive/10 border-b border-destructive/20">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-destructive">
                    <UserX className="h-5 w-5" /> De-provision Identity
                </CardTitle>
                <CardDescription className="text-xs font-medium text-destructive/70">Terminate your institutional account and excise all associated data.</CardDescription>
            </CardHeader>
            <CardContent className="pt-10 flex flex-col items-center justify-center text-center gap-6">
                <div className="p-6 bg-white rounded-full shadow-inner"><UserX className="h-12 w-12 text-destructive/20" /></div>
                <p className="text-xs font-medium text-slate-500 max-w-xs leading-relaxed uppercase tracking-wider">Account excision is a non-reversible protocol. All academic transcripts will be archived and access revoked.</p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeletingAccount} className="h-12 px-10 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-destructive/20">
                            {isDeletingAccount ? 'Excising...' : 'Terminate Identity'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Authorize Account Excision?</AlertDialogTitle>
                            <AlertDialogDescription className="leading-relaxed">This action will permanently terminate your access to the Campus Connect ledger. This procedure cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-4">
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAccount} className="rounded-xl bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px] tracking-widest h-12 px-8">Confirm Excision</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}