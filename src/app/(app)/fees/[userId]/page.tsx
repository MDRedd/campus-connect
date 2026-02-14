'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, DollarSign, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
}

const feeSchema = z.object({
  description: z.string().min(5, 'Description is required.'),
  totalAmount: z.coerce.number().min(0, 'Amount must be positive.'),
  amountPaid: z.coerce.number().min(0, 'Amount must be positive.').optional(),
  dueDate: z.string().min(1, 'Due date is required.'),
  status: z.enum(['Paid', 'Unpaid', 'Overdue']),
});

export default function ManageStudentFeesPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userId = params.userId as string;

  const [openDialog, setOpenDialog] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);

  const studentDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);
  const { data: student, isLoading: isStudentLoading } = useDoc<UserProfile>(studentDocRef);

  const feesQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(collection(firestore, 'users', userId, 'fees'));
  }, [firestore, userId]);
  const { data: fees, isLoading: areFeesLoading } = useCollection<Fee>(feesQuery);

  const form = useForm<z.infer<typeof feeSchema>>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      amountPaid: 0,
      status: 'Unpaid',
    },
  });

  const handleAddNew = () => {
    setEditingFee(null);
    form.reset({ amountPaid: 0, status: 'Unpaid', description: '', totalAmount: 0, dueDate: '' });
    setOpenDialog(true);
  };
  
  const handleEdit = (fee: Fee) => {
    setEditingFee(fee);
    form.reset({
        description: fee.description,
        totalAmount: fee.totalAmount,
        amountPaid: fee.amountPaid,
        dueDate: format(fee.dueDate.toDate(), 'yyyy-MM-dd'),
        status: fee.status,
    });
    setOpenDialog(true);
  };
  
  const handleDelete = (feeId: string) => {
    if (!firestore || !userId) return;
    if (!confirm('Are you sure you want to delete this fee record? This cannot be undone.')) return;
    const feeRef = doc(firestore, 'users', userId, 'fees', feeId);
    deleteDocumentNonBlocking(feeRef);
    toast({ title: 'Fee Deleted', description: 'The fee record has been removed.'});
  };

  function onSubmit(values: z.infer<typeof feeSchema>) {
    if (!firestore || !userId) return;

    const dataToSave = {
        ...values,
        dueDate: new Date(values.dueDate),
        amountPaid: values.amountPaid || 0,
    };

    if (editingFee) {
        const feeRef = doc(firestore, 'users', userId, 'fees', editingFee.id);
        updateDocumentNonBlocking(feeRef, dataToSave);
        toast({ title: 'Fee Updated', description: 'The fee record has been updated.' });
    } else {
        const feesRef = collection(firestore, 'users', userId, 'fees');
        addDocumentNonBlocking(feesRef, dataToSave);
        toast({ title: 'Fee Added', description: 'The new fee has been added for the student.' });
    }

    setOpenDialog(false);
    setEditingFee(null);
  }

  const getStatusVariant = (status: Fee['status']) => {
    switch (status) {
      case 'Paid': return 'default';
      case 'Unpaid': return 'secondary';
      case 'Overdue': return 'destructive';
      default: return 'secondary';
    }
  };

  const isLoading = isStudentLoading || areFeesLoading;

  return (
    <div className="flex flex-col gap-6">
       <Button variant="outline" size="sm" className="w-fit" onClick={() => router.push('/fees')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fee Management
      </Button>

       {isLoading ? <Skeleton className="h-10 w-1/2" /> : (
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Manage Fees</h1>
                <p className="text-muted-foreground">
                    Viewing fee records for <span className="font-semibold">{student?.name}</span> ({student?.email})
                </p>
            </div>
       )}
      
      <Card>
        <CardHeader className="flex-row justify-between items-start">
            <div>
                <CardTitle>Fee Records</CardTitle>
                <CardDescription>A list of all fees assigned to this student.</CardDescription>
            </div>
             <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Add Fee</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingFee ? 'Edit Fee Record' : 'Add New Fee'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="e.g., Tuition Fee - Fall 2024" /></FormControl><FormMessage /></FormItem> )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="totalAmount" render={({ field }) => ( <FormItem><FormLabel>Total Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="amountPaid" render={({ field }) => ( <FormItem><FormLabel>Amount Paid</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Unpaid">Unpaid</SelectItem>
                                            <SelectItem value="Paid">Paid</SelectItem>
                                            <SelectItem value="Overdue">Overdue</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Saving...' : 'Save Record'}</Button>
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
                        <TableHead className="w-[40%]">Description</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)
                ) : fees && fees.length > 0 ? (
                    fees.map(fee => (
                        <TableRow key={fee.id}>
                            <TableCell className="font-medium">{fee.description}</TableCell>
                            <TableCell>${fee.totalAmount.toFixed(2)}</TableCell>
                            <TableCell>{format(fee.dueDate.toDate(), 'PPP')}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(fee.status)}>{fee.status}</Badge></TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(fee)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(fee.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No fee records found for this student.</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
