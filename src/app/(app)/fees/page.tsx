'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, writeBatch, doc, where, getDocs, collectionGroup } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, DollarSign, Users, PlusCircle, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
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


type Fee = {
  id: string;
  studentId: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: any; // Firestore timestamp
  status: 'Paid' | 'Unpaid' | 'Overdue';
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
}

const newFeeSchema = z.object({
  studentId: z.string().min(1, 'Please select a student.'),
  description: z.string().min(5, 'Description is required.'),
  totalAmount: z.coerce.number().min(0, 'Amount must be positive.'),
  dueDate: z.string().min(1, 'Due date is required.'),
  status: z.enum(['Paid', 'Unpaid', 'Overdue']),
});

const bulkFeeSchema = z.object({
    description: z.string().min(5, 'Description is required.'),
    totalAmount: z.coerce.number().min(0, 'Amount must be positive.'),
    dueDate: z.string().min(1, 'Due date is required.'),
});

export default function FeesPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');
  
  const [openNewFeeDialog, setOpenNewFeeDialog] = useState(false);
  const [openBulkDialog, setOpenBulkDialog] = useState(false);

  // --- Student Data ---
  const studentFeesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return query(collection(firestore, 'users', authUser.uid, 'fees'));
  }, [firestore, authUser, userProfile]);
  const { data: fees, isLoading: areFeesLoading } = useCollection<Fee>(studentFeesQuery);

  // --- Admin Data ---
  const isFeeAdmin = userProfile?.role === 'super-admin';

  const studentsQuery = useMemoFirebase(() => {
      if (!firestore || !isFeeAdmin) return null;
      return query(collection(firestore, 'users'), where('role', '==', 'student'));
  }, [firestore, isFeeAdmin]);
  const { data: allStudents, isLoading: areStudentsLoading } = useCollection<UserProfile>(studentsQuery);
  
  const [allFees, setAllFees] = useState<Fee[] | null>(null);
  const [areAllFeesLoading, setAreAllFeesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !isFeeAdmin) {
        setAreAllFeesLoading(false);
        return;
    }
    const fetchAllFees = async () => {
        setAreAllFeesLoading(true);
        try {
            const feesQuery = query(collectionGroup(firestore, 'fees'));
            const snapshot = await getDocs(feesQuery);
            const feesData = snapshot.docs.map(doc => ({
                id: doc.id,
                studentId: doc.ref.parent.parent!.id,
                ...doc.data()
            } as Fee));
            setAllFees(feesData);
        } catch (error) {
            console.error("Error fetching all fees: ", error);
            setAllFees([]);
        } finally {
            setAreAllFeesLoading(false);
        }
    };
    fetchAllFees();
  }, [firestore, isFeeAdmin]);

  const newFeeForm = useForm<z.infer<typeof newFeeSchema>>({
    resolver: zodResolver(newFeeSchema),
    defaultValues: { status: 'Unpaid' }
  });

  const bulkFeeForm = useForm<z.infer<typeof bulkFeeSchema>>({
      resolver: zodResolver(bulkFeeSchema),
  });

  // --- Student View Calculations ---
  const totalDue = useMemo(() => {
    if (!fees) return 0;
    return fees.reduce((acc, fee) => {
      if (fee.status !== 'Paid') {
        return acc + (fee.totalAmount - fee.amountPaid);
      }
      return acc;
    }, 0);
  }, [fees]);
  
  // --- Admin View Calculations ---
  const adminStats = useMemo(() => {
    if (!allFees) return { totalOutstanding: 0, totalPaid: 0, overdueCount: 0 };
    const now = new Date();
    return allFees.reduce((acc, fee) => {
        if (fee.status === 'Paid') {
            acc.totalPaid += fee.amountPaid;
        } else {
            acc.totalOutstanding += fee.totalAmount - fee.amountPaid;
            if (fee.dueDate && fee.dueDate.toDate() < now) {
                acc.overdueCount++;
            }
        }
        return acc;
    }, { totalOutstanding: 0, totalPaid: 0, overdueCount: 0 });
  }, [allFees]);

  const studentsWithDues = useMemo(() => {
      if (!allFees || !allStudents) return [];
      const studentDues: Record<string, { profile: UserProfile, totalDue: number }> = {};
      
      allFees.forEach(fee => {
          if (fee.status !== 'Paid') {
              if (!studentDues[fee.studentId]) {
                  const studentProfile = allStudents.find(s => s.id === fee.studentId);
                  if (studentProfile) {
                      studentDues[fee.studentId] = { profile: studentProfile, totalDue: 0 };
                  }
              }
              if (studentDues[fee.studentId]) {
                  studentDues[fee.studentId].totalDue += (fee.totalAmount - fee.amountPaid);
              }
          }
      });
      return Object.values(studentDues).sort((a,b) => b.totalDue - a.totalDue);
  }, [allFees, allStudents]);
  
  const isLoading = isUserLoading || areFeesLoading || (isFeeAdmin && (areStudentsLoading || areAllFeesLoading));

  const getStatusVariant = (status: Fee['status']) => {
    switch (status) {
      case 'Paid': return 'default';
      case 'Unpaid': return 'secondary';
      case 'Overdue': return 'destructive';
      default: return 'secondary';
    }
  };

  const handlePayDues = async () => {
    if (!firestore || !authUser || !fees) return;

    const unpaidFees = fees.filter(fee => fee.status !== 'Paid');
    if (unpaidFees.length === 0) return;

    setIsPaying(true);
    const batch = writeBatch(firestore);

    unpaidFees.forEach(fee => {
      const feeRef = doc(firestore, 'users', authUser.uid, 'fees', fee.id);
      batch.update(feeRef, {
        status: 'Paid',
        amountPaid: fee.totalAmount
      });
    });

    try {
      await batch.commit();
      toast({
        title: 'Payment Successful',
        description: 'Your outstanding dues have been marked as paid.',
      });
    } catch (error) {
      console.error("Error paying dues:", error);
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: 'There was an error processing your payment. Please try again.',
      });
    } finally {
      setIsPaying(false);
    }
  };

  function onNewFeeSubmit(values: z.infer<typeof newFeeSchema>) {
    if (!firestore) return;
    const { studentId, ...feeData } = values;
    
    addDocumentNonBlocking(collection(firestore, 'users', studentId, 'fees'), {
        ...feeData,
        dueDate: new Date(values.dueDate),
        amountPaid: 0,
    });
    
    toast({ title: 'Fee Created', description: 'The new fee record has been added.'});
    setOpenNewFeeDialog(false);
    newFeeForm.reset();
  }

  async function onBulkFeeSubmit(values: z.infer<typeof bulkFeeSchema>) {
      if (!firestore || !allStudents) return;
      setIsBulkCreating(true);
      
      const batch = writeBatch(firestore);
      allStudents.forEach(student => {
          const feeRef = doc(collection(firestore, 'users', student.id, 'fees'));
          batch.set(feeRef, {
              description: values.description,
              totalAmount: values.totalAmount,
              amountPaid: 0,
              dueDate: new Date(values.dueDate),
              status: 'Unpaid',
          });
      });

      try {
          await batch.commit();
          toast({ title: 'Success', description: `Assigned fee to ${allStudents.length} students.` });
          setOpenBulkDialog(false);
          bulkFeeForm.reset();
      } catch (e) {
          console.error("Bulk fee creation error:", e);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign bulk fees.' });
      } finally {
          setIsBulkCreating(false);
      }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  // --- Admin View ---
  if (isFeeAdmin) {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fee Management</h1>
                    <p className="text-muted-foreground">Global overview of student fees and payments.</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={openBulkDialog} onOpenChange={setOpenBulkDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><HandCoins className="mr-2 h-4 w-4" /> Bulk Assign Fee</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Fee</DialogTitle>
                                <DialogDescription>This will create a new fee record for EVERY student on campus.</DialogDescription>
                            </DialogHeader>
                            <Form {...bulkFeeForm}>
                                <form onSubmit={bulkFeeForm.handleSubmit(onBulkFeeSubmit)} className="space-y-4">
                                    <FormField control={bulkFeeForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="e.g., Tuition Fee - Spring 2025" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={bulkFeeForm.control} name="totalAmount" render={({ field }) => ( <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={bulkFeeForm.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isBulkCreating}>{isBulkCreating ? 'Processing...' : 'Assign to All Students'}</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={openNewFeeDialog} onOpenChange={setOpenNewFeeDialog}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Individual Fee</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign Individual Fee</DialogTitle>
                            </DialogHeader>
                             <Form {...newFeeForm}>
                                <form onSubmit={newFeeForm.handleSubmit(onNewFeeSubmit)} className="space-y-4">
                                     <FormField control={newFeeForm.control} name="studentId" render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Student</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger></FormControl>
                                            <SelectContent>{allStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={newFeeForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="e.g., Library Fine" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={newFeeForm.control} name="totalAmount" render={({ field }) => ( <FormItem><FormLabel>Total Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={newFeeForm.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={newFeeForm.control} name="status" render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Unpaid">Unpaid</SelectItem>
                                                <SelectItem value="Overdue">Overdue</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={newFeeForm.formState.isSubmitting}>{newFeeForm.formState.isSubmitting ? 'Creating...' : 'Assign Fee'}</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Dues</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">${adminStats.totalOutstanding.toLocaleString()}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">${adminStats.totalPaid.toLocaleString()}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Students with Dues</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{studentsWithDues.length}</div></CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Fee Balances by Student</CardTitle>
                    <CardDescription>Click a student to manage their individual fee records.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Roll Number</TableHead>
                                <TableHead>Total Due</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {studentsWithDues.length > 0 ? (
                            studentsWithDues.map(({profile, totalDue}) => (
                                <TableRow key={profile.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={profile.name} data-ai-hint="person portrait" />}
                                                <AvatarFallback>{profile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <div className="font-medium">{profile.name}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{profile.rollNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-semibold text-destructive">${totalDue.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`/fees/${profile.id}`}>Manage Records</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">No students with outstanding dues found.</TableCell></TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
  }
  
  // --- Student View ---
  if (userProfile?.role === 'student') {
    return (
        <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Fee Status</h1>
            <p className="text-muted-foreground">
            View your fee details, payment history, and pay outstanding dues.
            </p>
        </div>

        <Card>
            <CardHeader>
            <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="flex items-center justify-between text-2xl font-bold">
                <span>Total Amount Due</span>
                <span>${totalDue.toFixed(2)}</span>
            </div>
            </CardContent>
            <CardFooter>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button disabled={totalDue === 0 || isPaying}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    {isPaying ? 'Processing...' : 'Pay Total Due'}
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                    <AlertDialogDescription>
                    You are about to pay a total of ${totalDue.toFixed(2)}. This will clear all your outstanding dues. This action is for demonstration purposes.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePayDues}>Confirm and Pay</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </CardFooter>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Fee Details</CardTitle>
                <CardDescription>A breakdown of your fees for the current academic session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {fees && fees.length > 0 ? (
                fees.map((fee) => (
                    <div key={fee.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold">{fee.description}</h3>
                                <p className="text-sm text-muted-foreground">
                                    Due by: {fee.dueDate ? format(fee.dueDate.toDate(), 'PPP') : 'N/A'}
                                </p>
                            </div>
                            <Badge variant={getStatusVariant(fee.status)}>{fee.status}</Badge>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Total Amount</p>
                                <p className="font-medium">${fee.totalAmount.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Amount Paid</p>
                                <p className="font-medium">${fee.amountPaid.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Amount Due</p>
                                <p className="font-medium text-destructive">${(fee.totalAmount - fee.amountPaid).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <DollarSign className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Fees Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Your fee details will appear here.</p>
                </div>
            )}
            </CardContent>
        </Card>
        </div>
    );
  }

  // Fallback
  return (
    <Card>
        <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only students or fee administrators can view this page.</CardDescription>
        </CardHeader>
    </Card>
  )
}
