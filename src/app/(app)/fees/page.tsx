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
import { CreditCard, DollarSign, Users, PlusCircle, HandCoins, ArrowRight } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type Fee = {
  id: string;
  studentId: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: any;
  status: 'Paid' | 'Unpaid' | 'Overdue';
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
  role: string;
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

  const studentFeesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return query(collection(firestore, 'users', authUser.uid, 'fees'));
  }, [firestore, authUser, userProfile]);
  const { data: fees, isLoading: areFeesLoading } = useCollection<Fee>(studentFeesQuery);

  const isFeeAdmin = userProfile?.role?.includes('admin');

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

  const totalDue = useMemo(() => {
    if (!fees) return 0;
    return fees.reduce((acc, fee) => {
      if (fee.status !== 'Paid') {
        return acc + (fee.totalAmount - fee.amountPaid);
      }
      return acc;
    }, 0);
  }, [fees]);
  
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
      batch.update(feeRef, { status: 'Paid', amountPaid: fee.totalAmount });
    });
    try {
      await batch.commit();
      toast({ title: 'Payment Successful', description: 'Your outstanding dues have been marked as paid.' });
    } catch (error) {
      console.error("Error paying dues:", error);
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'Error processing your payment.' });
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
    toast({ title: 'Fee Created', description: 'New fee record added.'});
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
        <Skeleton className="h-10 w-1/3 rounded-xl" />
        <Card className="glass-card"><CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (isFeeAdmin) {
    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight unique-gradient-text uppercase">FEE MANAGEMENT</h1>
                    <p className="text-muted-foreground font-medium">System-wide financial administration and collections.</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={openBulkDialog} onOpenChange={setOpenBulkDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-xl border-indigo-200"><HandCoins className="mr-2 h-4 w-4" /> Bulk Assign</Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Fee</DialogTitle>
                                <DialogDescription>This creates a new fee record for ALL registered students.</DialogDescription>
                            </DialogHeader>
                            <Form {...bulkFeeForm}>
                                <form onSubmit={bulkFeeForm.handleSubmit(onBulkFeeSubmit)} className="space-y-4">
                                    <FormField control={bulkFeeForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="e.g., Annual Tuition 2024" className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={bulkFeeForm.control} name="totalAmount" render={({ field }) => ( <FormItem><FormLabel>Total Amount</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={bulkFeeForm.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isBulkCreating} className="rounded-xl h-12 px-8">{isBulkCreating ? 'Processing...' : 'Assign to All'}</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={openNewFeeDialog} onOpenChange={setOpenNewFeeDialog}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl shadow-lg shadow-indigo-500/20"><PlusCircle className="mr-2 h-4 w-4" /> New Individual Fee</Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>Assign Individual Fee</DialogTitle>
                                <DialogDescription>Assign a unique fee to a single selected student.</DialogDescription>
                            </DialogHeader>
                             <Form {...newFeeForm}>
                                <form onSubmit={newFeeForm.handleSubmit(onNewFeeSubmit)} className="space-y-4">
                                     <FormField control={newFeeForm.control} name="studentId" render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Student</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{allStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.rollNumber || 'No ID'})</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={newFeeForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={newFeeForm.control} name="totalAmount" render={({ field }) => ( <FormItem><FormLabel>Total Amount</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={newFeeForm.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem> )} />
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={newFeeForm.formState.isSubmitting} className="rounded-xl h-12 px-8">Assign Fee</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="glass-card border-none bg-indigo-500 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest opacity-80">Outstanding Dues</CardTitle>
                        <DollarSign className="h-4 w-4 opacity-50" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-black tracking-tighter">${adminStats.totalOutstanding.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="glass-card border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Collected</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-black tracking-tighter">${adminStats.totalPaid.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="glass-card border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Active Balances</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent><div className="text-3xl font-black tracking-tighter">{studentsWithDues.length} Students</div></CardContent>
                </Card>
            </div>
            
            <Card className="glass-card border-none overflow-hidden">
                <CardHeader className="bg-white/40 border-b border-white/20">
                    <CardTitle>Student Ledger</CardTitle>
                    <CardDescription>Individual student balances and payment tracking.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="pl-6 uppercase text-[10px] font-black tracking-widest">Student</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Roll Number</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Total Due</TableHead>
                                <TableHead className="text-right pr-6 uppercase text-[10px] font-black tracking-widest">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {studentsWithDues.length > 0 ? (
                            studentsWithDues.map(({profile, totalDue}) => (
                                <TableRow key={profile.id} className="hover:bg-indigo-50/30 group">
                                    <TableCell className="pl-6">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={profile.name} />}
                                                <AvatarFallback className="font-black text-xs uppercase bg-primary/5 text-primary">{profile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <div className="font-bold text-slate-700">{profile.name}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{profile.rollNumber || 'N/A'}</TableCell>
                                    <TableCell className="font-black text-destructive tracking-tight">${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button asChild size="sm" variant="ghost" className="rounded-xl group-hover:bg-white group-hover:shadow-sm">
                                            <Link href={`/fees/${profile.id}`}>Manage Ledger <ArrowRight className="ml-2 h-3 w-3" /></Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-32 text-center font-bold text-muted-foreground uppercase tracking-tighter text-sm opacity-40">All financial clear for current term</TableCell></TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
  }
  
  return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
            <h1 className="text-3xl font-black tracking-tight unique-gradient-text uppercase">FEE STATUS</h1>
            <p className="text-muted-foreground font-medium">Review your institutional dues and processing history.</p>
        </div>
        <Card className="glass-card border-none bg-indigo-500 text-white overflow-hidden">
            <CardHeader className="bg-black/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest opacity-80">Total Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter">${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-indigo-200 text-sm font-bold uppercase tracking-widest">USD</span>
            </CardContent>
            <CardFooter className="bg-black/10 flex justify-end">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button disabled={totalDue === 0 || isPaying} className="bg-white text-indigo-600 hover:bg-indigo-50 font-black rounded-xl px-8 h-12 shadow-xl shadow-black/20">
                    <DollarSign className="mr-2 h-4 w-4" />
                    {isPaying ? 'Processing...' : 'Settle Total Due'}
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Payment Submission</AlertDialogTitle>
                    <AlertDialogDescription>You are about to authorize a total payment of <span className="font-black text-slate-900">${totalDue.toFixed(2)}</span>. This action will clear all your currently unpaid fee records.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePayDues} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">Authorize Payment</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </CardFooter>
        </Card>

        <div className="grid gap-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Individual Record Breakdown</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fees && fees.length > 0 ? (
                fees.map((fee) => (
                    <Card key={fee.id} className="glass-card border-none flex flex-col group hover:ring-2 hover:ring-indigo-500/20">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h3 className="font-black text-slate-800 tracking-tight leading-none uppercase text-sm">{fee.description}</h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 pt-1">
                                        <CreditCard className="h-3 w-3" />
                                        Due: {fee.dueDate ? format(fee.dueDate.toDate(), 'MMM d, yyyy') : 'N/A'}
                                    </p>
                                </div>
                                <Badge variant={getStatusVariant(fee.status)} className="rounded-lg font-black uppercase text-[9px] tracking-widest">{fee.status}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Total</p>
                                    <p className="font-bold text-slate-700">${fee.totalAmount.toFixed(2)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Paid</p>
                                    <p className="font-bold text-green-600">${fee.amountPaid.toFixed(2)}</p>
                                </div>
                            </div>
                            <Separator className="bg-indigo-100/50" />
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Balance Remaining</p>
                                <p className={cn("text-xl font-black tracking-tighter", fee.status === 'Paid' ? 'text-slate-300' : 'text-destructive')}>
                                    ${(fee.totalAmount - fee.amountPaid).toFixed(2)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="col-span-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-[2rem] bg-slate-50/50">
                    <div className="bg-white p-6 rounded-full shadow-inner mb-4">
                        <DollarSign className="h-12 w-12 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-400">No Financial Records Found</h3>
                    <p className="text-sm text-slate-400 max-w-xs mt-2 leading-relaxed">If you believe you have pending fees, please contact the campus finance office.</p>
                </div>
            )}
            </div>
        </div>
        </div>
    );
}