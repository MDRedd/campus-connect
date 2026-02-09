'use client'

import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
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

type UserProfile = {
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    newGrades: boolean;
    deadlineReminders: boolean;
  };
};

export default function SettingsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handlePreferenceChange = async (key: keyof NonNullable<UserProfile['notificationPreferences']>, value: boolean) => {
    if (!userDocRef) return;
    try {
      await updateDoc(userDocRef, {
        // Use dot notation to update a field in a nested object
        [`notificationPreferences.${key}`]: value,
      });
      toast({
        title: 'Settings Saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your settings.',
      });
    }
  };
  
  const isLoading = isAuthUserLoading || isUserProfileLoading;

  if (isLoading) {
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
                disabled={isUserProfileLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications">Push Notifications</Label>
            <Switch
                id="push-notifications"
                checked={userProfile?.notificationPreferences?.push ?? false}
                onCheckedChange={(checked) => handlePreferenceChange('push', checked)}
                disabled={isUserProfileLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="new-grades-notifications">New Grades</Label>
            <Switch
                id="new-grades-notifications"
                checked={userProfile?.notificationPreferences?.newGrades ?? true}
                onCheckedChange={(checked) => handlePreferenceChange('newGrades', checked)}
                disabled={isUserProfileLoading}
            />
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="deadline-reminders-notifications">Deadline Reminders</Label>
            <Switch
                id="deadline-reminders-notifications"
                checked={userProfile?.notificationPreferences?.deadlineReminders ?? true}
                onCheckedChange={(checked) => handlePreferenceChange('deadlineReminders', checked)}
                disabled={isUserProfileLoading}
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
            <Input id="password" type="password" />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 flex justify-between">
            <Button>Update Password</Button>
            <Button variant="destructive">Delete Account</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
