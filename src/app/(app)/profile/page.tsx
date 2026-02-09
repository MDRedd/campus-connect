
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
import { Pencil, Save } from 'lucide-react';
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

type UserProfile = {
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  department?: string;
};

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  department: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

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


  const isLoading = isAuthUserLoading || isUserProfileLoading;

  const userInitials = userProfile?.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userDocRef) return;
    try {
      await updateDoc(userDocRef, {
        name: data.name,
        department: data.department,
      });
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your profile. Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Profile</CardTitle>
          <CardDescription>
            Manage your personal information and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center gap-4 md:col-span-1 pt-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="text-center">
                <Skeleton className="h-8 w-32 mt-4" />
                <Skeleton className="h-6 w-48 mt-2" />
            </div>
          </div>
          <div className="grid gap-y-6 text-sm md:col-span-2">
             <div className="grid grid-cols-4 items-center gap-4">
              <p className="text-muted-foreground">Full Name</p>
              <Skeleton className="h-6 w-full col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <p className="text-muted-foreground">Email</p>
              <Skeleton className="h-6 w-full col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <p className="text-muted-foreground">Role</p>
              <Skeleton className="h-6 w-full col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <p className="text-muted-foreground">Department</p>
              <Skeleton className="h-6 w-full col-span-3" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }

  if (!userProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Profile</CardTitle>
          <CardDescription>
            Could not load user profile. Please try logging in again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Profile</CardTitle>
            <CardDescription>
              View and manage your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center gap-4 md:col-span-1 pt-6">
              <Avatar className="h-32 w-32 text-4xl">
                {userAvatar && (
                  <AvatarImage
                    src={userAvatar.imageUrl}
                    alt={userProfile.name}
                    data-ai-hint={userAvatar.imageHint}
                  />
                )}
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-2xl font-bold">{userProfile.name}</h2>
                <p className="text-muted-foreground">{userProfile.email}</p>
              </div>
            </div>
            <div className="grid gap-y-6 text-sm md:col-span-2">
              {!isEditing ? (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="col-span-3 font-medium">{userProfile.name}</p>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-muted-foreground">Email</p>
                    <p className="col-span-3 font-medium">{userProfile.email}</p>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-muted-foreground">Role</p>
                    <p className="col-span-3 font-medium capitalize">{userProfile.role}</p>
                  </div>
                  {userProfile.department && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <p className="text-muted-foreground">Department</p>
                      <p className="col-span-3 font-medium">{userProfile.department}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-muted-foreground">Full Name</FormLabel>
                        <FormControl className="col-span-3">
                          <Input {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-muted-foreground">Email</p>
                    <p className="col-span-3 font-medium">{userProfile.email}</p>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <p className="text-muted-foreground">Role</p>
                    <p className="col-span-3 font-medium capitalize">{userProfile.role}</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-muted-foreground">Department</FormLabel>
                        <FormControl className="col-span-3">
                          <Input {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4" />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            {isEditing ? (
              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
