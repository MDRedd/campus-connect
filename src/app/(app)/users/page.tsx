'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  department?: string;
  rollNumber?: string;
  facultyCode?: string;
};

const userEditSchema = z.object({
  role: z.enum(['student', 'faculty', 'super-admin', 'user-admin', 'course-admin', 'attendance-admin']),
  department: z.string().optional(),
});

const userCreationSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    role: z.enum(['student', 'faculty', 'super-admin', 'user-admin', 'course-admin', 'attendance-admin']),
    department: z.string().optional(),
});

export default function UsersPage() {
  const { user: authUser, profile: currentUserProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile || !['super-admin', 'user-admin'].includes(currentUserProfile.role)) return null;
    return collection(firestore, 'users');
  }, [firestore, currentUserProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(allUsersQuery);

  const editForm = useForm<z.infer<typeof userEditSchema>>({
    resolver: zodResolver(userEditSchema),
  });

  const createForm = useForm<z.infer<typeof userCreationSchema>>({
    resolver: zodResolver(userCreationSchema),
    defaultValues: {
        name: '',
        email: '',
        password: '',
        role: 'student',
        department: '',
    },
  });

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    editForm.reset({
      role: user.role,
      department: user.department || '',
    });
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (user: UserProfile) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (!firestore || !deletingUser) return;
    
    const userToDeleteRef = doc(firestore, 'users', deletingUser.id);
    deleteDocumentNonBlocking(userToDeleteRef);
    
    toast({ title: 'Success', description: `User ${deletingUser.name} has been deleted.` });
    setIsDeleteDialogOpen(false);
    setDeletingUser(null);
  };

  const onEditSubmit = (values: z.infer<typeof userEditSchema>) => {
    if (!firestore || !editingUser) return;
    
    const userToUpdateRef = doc(firestore, 'users', editingUser.id);
    updateDocumentNonBlocking(userToUpdateRef, {
      role: values.role,
      department: values.department,
    });
    
    toast({ title: 'Success', description: `User ${editingUser.name} has been updated.` });
    setIsEditDialogOpen(false);
  };

  const onUserCreate = async (values: z.infer<typeof userCreationSchema>) => {
    if (!firestore) return;
    
    // We create a temporary app instance to create a user without signing the admin out
    const tempAppName = `user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
        const newUser = userCredential.user;

        await updateProfile(newUser, { displayName: values.name });
        
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userData = {
            id: newUser.uid,
            name: values.name,
            email: values.email,
            role: values.role,
            department: values.department || '',
        };
        
        setDocumentNonBlocking(userDocRef, userData, {});
        
        toast({ title: 'User Created', description: `${values.name} has been added.` });
        setIsCreateDialogOpen(false);
        createForm.reset();
    } catch (error: any) {
        console.error("Error creating user:", error);
        toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: error.code === 'auth/email-already-in-use' ? 'This email is already in use.' : 'An unknown error occurred.',
        });
    } finally {
        await deleteApp(tempApp);
    }
  }


  const isLoading = isUserLoading || areUsersLoading;

  if (isUserLoading) {
      return <Skeleton className="h-96 w-full" />;
  }

  if (currentUserProfile && !['super-admin', 'user-admin'].includes(currentUserProfile.role)) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have permission to view this page.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          View and manage all users on the platform.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>A list of all registered users.</CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> Create User</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
                 <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onUserCreate)} className="space-y-4">
                        <FormField control={createForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="John Doe" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="user@example.com" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={createForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={createForm.control} name="role" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="faculty">Faculty</SelectItem>
                                    <SelectItem value="user-admin">User Admin</SelectItem>
                                    <SelectItem value="course-admin">Course Admin</SelectItem>
                                    <SelectItem value="attendance-admin">Attendance Admin</SelectItem>
                                    <SelectItem value="super-admin">Super Admin</SelectItem>
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={createForm.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., Computer Science" /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={createForm.formState.isSubmitting}>
                                {createForm.formState.isSubmitting ? 'Creating...' : 'Create User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : allUsers && allUsers.length > 0 ? (
                allUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={user.name} data-ai-hint={userAvatar.imageHint} />}
                          <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{user.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role.includes('admin') ? 'destructive' : user.role === 'faculty' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.department || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} disabled={user.id === authUser?.uid}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit User</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(user)} disabled={user.id === authUser?.uid}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete User</span>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
                <DialogDescription>{editingUser?.email}</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <FormField
                        control={editForm.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="faculty">Faculty</SelectItem>
                                    <SelectItem value="user-admin">User Admin</SelectItem>
                                    <SelectItem value="course-admin">Course Admin</SelectItem>
                                    <SelectItem value="attendance-admin">Attendance Admin</SelectItem>
                                    <SelectItem value="super-admin">Super Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={editForm.control}
                        name="department"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Department</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g., Computer Science" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={editForm.formState.isSubmitting}>
                            {editForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will delete the user data for <span className="font-semibold">{deletingUser?.name}</span>. This action cannot be undone and does not remove their login credentials.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingUser(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete}>Delete User Data</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
