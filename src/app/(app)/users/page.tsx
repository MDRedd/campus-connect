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
import { Edit, Trash2, PlusCircle, Search, FilterX, UsersRound, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
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
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

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
    rollNumber: z.string().optional(),
    facultyCode: z.string().optional(),
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

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile || !['super-admin', 'user-admin'].includes(currentUserProfile.role)) return null;
    return collection(firestore, 'users');
  }, [firestore, currentUserProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(allUsersQuery);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return null;
    return allUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });
  }, [allUsers, searchQuery, roleFilter]);

  const editForm = useForm<z.infer<typeof userEditSchema>>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      role: 'student',
      department: '',
    }
  });

  const createForm = useForm<z.infer<typeof userCreationSchema>>({
    resolver: zodResolver(userCreationSchema),
    defaultValues: {
        name: '',
        email: '',
        password: '',
        role: 'student',
        department: '',
        rollNumber: '',
        facultyCode: '',
    },
  });

  const watchedRole = useWatch({
    control: createForm.control,
    name: 'role'
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
    const tempAppName = `user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
        const newUser = userCredential.user;
        await updateProfile(newUser, { displayName: values.name });
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userData: any = {
            id: newUser.uid,
            name: values.name,
            email: values.email,
            role: values.role,
            department: values.department || '',
            ...(values.rollNumber && { rollNumber: values.rollNumber }),
            ...(values.facultyCode && { facultyCode: values.facultyCode }),
        };
        setDocumentNonBlocking(userDocRef, userData, {});
        toast({ title: 'User Created', description: `${values.name} has been added.` });
        setIsCreateDialogOpen(false);
        createForm.reset();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Creation Failed', description: error.code === 'auth/email-already-in-use' ? 'This email is already in use.' : 'An unknown error occurred.' });
    } finally {
        await deleteApp(tempApp);
    }
  }

  const isLoading = isUserLoading || areUsersLoading;

  if (!isUserLoading && currentUserProfile && !['super-admin', 'user-admin'].includes(currentUserProfile.role)) {
    return <div className="p-8"><Card className="glass-card border-none"><CardHeader><CardTitle>Access Restricted</CardTitle><CardDescription>Only administrative personnel may access the User Directory.</CardDescription></CardHeader></Card></div>
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700 pb-12">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <ShieldCheck className="h-3 w-3" /> Identity Master
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">USER DIRECTORY</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">Manage institutional personas, synchronize departmental roles, and authorize system access.</p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => createForm.reset()} className="bg-white text-primary hover:bg-indigo-50 font-black rounded-xl h-12 px-8 shadow-xl shadow-black/20 uppercase tracking-widest text-[10px]">
                        <UserPlus className="mr-2 h-4 w-4" /> Provision New User
                    </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">New Identity Enrollment</DialogTitle>
                        <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Provision a new institutional account.</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                        <form onSubmit={createForm.handleSubmit(onUserCreate)} className="space-y-4 py-4">
                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Legal Name</FormLabel>
                                    <FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="email" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</FormLabel>
                                    <FormControl><Input {...field} type="email" className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Initial Keyphrase</FormLabel>
                                    <FormControl><Input {...field} type="password" className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={createForm.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Institutional Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="student">Student</SelectItem>
                                            <SelectItem value="faculty">Faculty</SelectItem>
                                            <SelectItem value="user-admin">User Admin</SelectItem>
                                            <SelectItem value="course-admin">Course Admin</SelectItem>
                                            <SelectItem value="attendance-admin">Attendance Admin</SelectItem>
                                            <SelectItem value="super-admin">Super Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            {watchedRole === 'student' && (
                                <FormField control={createForm.control} name="rollNumber" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Enrollment Index (Roll No)</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., 2024001" className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                    </FormItem>
                                )} />
                            )}
                            {watchedRole === 'faculty' && (
                                <FormField control={createForm.control} name="facultyCode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Index (Faculty ID)</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., FAC1001" className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={createForm.control} name="department" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Academic Department</FormLabel>
                                    <FormControl><Input {...field} placeholder="e.g., Computer Science" className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter className="pt-6">
                                <DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose>
                                <Button type="submit" disabled={createForm.formState.isSubmitting} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                    {createForm.formState.isSubmitting ? 'Provisioning...' : 'Confirm Provisioning'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
              </Dialog>
          </div>
      </div>

      <Card className="glass-card border-none overflow-hidden shadow-2xl">
        <CardHeader className="bg-white/40 border-b border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-4 p-8">
            <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Active Identities</CardTitle>
                <CardDescription className="text-xs font-medium">Verified system participants and their assigned authorizations.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input placeholder="Search directory..." className="pl-10 h-11 rounded-xl bg-white border-slate-200 shadow-sm w-[240px] text-sm font-medium text-slate-900 placeholder:text-slate-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 bg-white shadow-sm text-xs font-black uppercase tracking-widest text-slate-900"><SelectValue placeholder="Role Filter" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                        <SelectItem value="super-admin">Admins</SelectItem>
                    </SelectContent>
                </Select>
                {(searchQuery || roleFilter !== 'all') && (
                    <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(''); setRoleFilter('all'); }} className="h-11 w-11 rounded-xl hover:bg-white hover:shadow-sm"><FilterX className="h-4 w-4" /></Button>
                )}
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Persona</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest">Institutional Email</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest">Authorization</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest">Department</TableHead>
                <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Ops</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="pl-8 pr-8"><Skeleton className="h-12 w-full rounded-xl" /></TableCell></TableRow>)
              ) : filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <TableRow key={user.id} className="hover:bg-indigo-50/30 group transition-colors">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-4 py-1">
                        <Avatar className="h-11 w-11 border-2 border-white shadow-sm ring-1 ring-indigo-50">
                          {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={user.name} />}
                          <AvatarFallback className="font-black text-xs uppercase bg-primary/5 text-primary">{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="font-black text-slate-800 truncate max-w-[140px] uppercase tracking-tight leading-tight">{user.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("rounded-lg font-black uppercase text-[9px] tracking-[0.1em] px-2.5 py-1", user.role.includes('admin') ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                        {user.role.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-slate-500">{user.department || 'General'}</TableCell>
                    <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-sm" onClick={() => handleEditClick(user)} disabled={user.id === authUser?.uid}>
                                <UserCog className="h-4 w-4 text-indigo-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteClick(user)} disabled={user.id === authUser?.uid}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-40 text-center font-bold text-muted-foreground uppercase tracking-tighter text-sm opacity-40">No matching identities found in directory</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-3xl">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Alter Authorization</DialogTitle>
                <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Target: {editingUser?.email}</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6 py-6">
                    <FormField control={editForm.control} name="role" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Access Tier</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="faculty">Faculty</SelectItem>
                                    <SelectItem value="user-admin">User Admin</SelectItem>
                                    <SelectItem value="course-admin">Course Admin</SelectItem>
                                    <SelectItem value="attendance-admin">Attendance Admin</SelectItem>
                                    <SelectItem value="super-admin">Super Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={editForm.control} name="department" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Departmental Alignment</FormLabel>
                            <FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-slate-900" /></FormControl>
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose>
                        <Button type="submit" disabled={editForm.formState.isSubmitting} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                            Save Ledger Changes
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Confirm Excision?</AlertDialogTitle>
                <AlertDialogDescription className="leading-relaxed">
                    This will remove the identity document for <span className="font-black text-slate-900">{deletingUser?.name}</span> from the active directory. Authentication remains valid unless revoked manually in the security console.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-4">
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-destructive hover:bg-destructive/90 font-black uppercase tracking-widest text-[10px] h-12 px-8">
                    Excise Identity
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}