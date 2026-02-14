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

export default function SettingsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
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
      title: 'Settings Saved',
      description: 'Your notification preferences have been updated.',
    });
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill in both password fields.' });
        return;
    }
    if (password !== confirmPassword) {
        toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match.' });
        return;
    }
    if (password.length < 6) {
        toast({ variant: 'destructive', title: 'Error', description: 'Password should be at least 6 characters.' });
        return;
    }
    if (!authUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your password.' });
        return;
    }

    setIsUpdatingPassword(true);
    try {
        await updatePassword(authUser, password);
        toast({ title: 'Success', description: 'Your password has been updated.' });
        setPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error('Error updating password:', error);
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: error.message || 'Could not update your password. You may need to sign in again.',
        });
    } finally {
        setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    setIsDeletingAccount(true);
    try {
        await deleteUser(authUser);
        toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' });
        // The onAuthStateChanged listener in the provider will handle the redirect.
    } catch (error: any) {
        console.error('Error deleting account:', error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: error.message || 'Could not delete your account. You may need to sign in again.',
        });
        setIsDeletingAccount(false);
    }
  };

  if (isUserLoading) {
    return (
        <div className="grid gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                Manage your account, notifications, and application settings.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Notification Settings</CardTitle>
                    <CardDescription>
                        Choose how you want to be notified.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="grid gap-6">
       <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, notifications, and application settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Choose how you want to be notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <Switch 
                id="email-notifications"
                checked={userProfile?.notificationPreferences?.email ?? true}
                onCheckedChange={(checked) => handlePreferenceChange('email', checked)}
                disabled={isUserLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications">Push Notifications</Label>
            <Switch
                id="push-notifications"
                checked={userProfile?.notificationPreferences?.push ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('push', checked)}
                disabled={isUserLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="new-grades-notifications">New Grades</Label>
            <Switch
                id="new-grades-notifications"
                checked={userProfile?.notificationPreferences?.newGrades ?? true}
                onCheckedChange={(checked) => handlePreferenceChange('newGrades', checked)}
                disabled={isUserLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="deadline-reminders-notifications">Deadline Reminders</Label>
            <Switch
                id="deadline-reminders-notifications"
                checked={userProfile?.notificationPreferences?.deadlineReminders ?? true}
                onCheckedChange={(checked) => handlePreferenceChange('deadlineReminders', checked)}
                disabled={isUserLoading}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Customize the appearance of the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between">
                 <Label>Dark Mode</Label>
                 <Switch defaultChecked disabled />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
                Theme switching is not yet implemented. The application is currently in dark mode.
            </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Manage your account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isUpdatingPassword} />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isUpdatingPassword} />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 flex justify-between">
            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeletingAccount}>
                        {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  )
}
