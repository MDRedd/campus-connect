'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
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
import { CreditCard, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Fee = {
  id: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: any; // Firestore timestamp
  status: 'Paid' | 'Unpaid' | 'Overdue';
};

export default function FeesPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();

  const feesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return query(collection(firestore, 'users', authUser.uid, 'fees'));
  }, [firestore, authUser]);
  const { data: fees, isLoading: areFeesLoading } = useCollection<Fee>(feesQuery);

  const totalDue = useMemo(() => {
    if (!fees) return 0;
    return fees.reduce((acc, fee) => {
      if (fee.status !== 'Paid') {
        return acc + (fee.totalAmount - fee.amountPaid);
      }
      return acc;
    }, 0);
  }, [fees]);

  const isLoading = isUserLoading || areFeesLoading;

  const getStatusVariant = (status: Fee['status']) => {
    switch (status) {
      case 'Paid': return 'default';
      case 'Unpaid': return 'secondary';
      case 'Overdue': return 'destructive';
      default: return 'secondary';
    }
  };

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

  if (userProfile?.role !== 'student') {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>Only students can view the fees page.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

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
          <Button disabled={totalDue === 0}>
            <DollarSign className="mr-2 h-4 w-4" /> Pay Total Due
          </Button>
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
                    {fee.status !== 'Paid' && (
                         <div className="flex justify-end">
                            <Button size="sm" variant="outline" disabled>
                                <CreditCard className="mr-2 h-4 w-4" /> Pay Now
                            </Button>
                        </div>
                    )}
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
