'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

type Course = { id: string; name: string; code: string; };
type Attendance = { id: string; date: any; status: 'present' | 'absent' };
type CorrectionRequest = { attendanceId: string; status: 'pending' | 'approved' | 'rejected' };

export default function StudentAttendanceDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();
    const courseId = params.courseId as string;

    const [requestingCorrection, setRequestingCorrection] = useState<Attendance | null>(null);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const courseDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId) return null;
        return doc(firestore, 'courses', courseId);
    }, [firestore, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

    const attendanceQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || !courseId) return null;
        return query(
            collection(firestore, 'users', authUser.uid, 'attendance'), 
            where('courseId', '==', courseId),
            orderBy('date', 'desc')
        );
    }, [firestore, authUser, courseId]);
    const { data: attendanceRecords, isLoading: areRecordsLoading } = useCollection<Attendance>(attendanceQuery);

    const correctionRequestsQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || !courseId) return null;
        return query(
            collection(firestore, 'correctionRequests'),
            where('studentId', '==', authUser.uid),
            where('courseId', '==', courseId)
        );
    }, [firestore, authUser, courseId]);
    const { data: correctionRequests, isLoading: areRequestsLoading } = useCollection<CorrectionRequest>(correctionRequestsQuery);
    
    const requestStatusMap = useMemo(() => {
        if (!correctionRequests) return new Map();
        return new Map(correctionRequests.map(req => [req.attendanceId, req.status]));
    }, [correctionRequests]);

    const isLoading = isCourseLoading || areRecordsLoading || areRequestsLoading;

    const getStatusVariant = (status: 'present' | 'absent') => {
        switch (status) {
            case 'present':
                return 'default';
            case 'absent':
                return 'destructive';
            default:
                return 'secondary';
        }
    };
    
    const getRequestStatusVariant = (status: CorrectionRequest['status']) => {
        switch (status) {
            case 'pending': return 'secondary';
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            default: return 'secondary';
        }
    };

    const handleRequestSubmit = () => {
        if (!firestore || !authUser || !courseId || !requestingCorrection || !reason.trim()) return;

        setIsSubmitting(true);
        addDocumentNonBlocking(collection(firestore, 'correctionRequests'), {
            studentId: authUser.uid,
            courseId: courseId,
            attendanceId: requestingCorrection.id,
            reason: reason.trim(),
            status: 'pending',
            requestedAt: serverTimestamp(),
        });
        
        toast({
            title: 'Request Submitted',
            description: 'Your faculty has been notified and will review your request.',
        });
        
        // Reset state and close dialog
        setIsSubmitting(false);
        setReason('');
        setRequestingCorrection(null);
    };

    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Attendance
            </Button>
            
            {isCourseLoading ? <Skeleton className="h-10 w-1/2" /> : (
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">{course?.name}</h1>
                    <p className="text-muted-foreground">Your detailed attendance history for {course?.code}.</p>
                </div>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Attendance Log</CardTitle>
                    <CardDescription>A record of your attendance for each class session. Incorrect mark? Request a correction.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions / Request Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : attendanceRecords && attendanceRecords.length > 0 ? (
                                attendanceRecords.map(record => {
                                    const requestStatus = requestStatusMap.get(record.id);
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium">
                                                {record.date ? format(record.date.toDate(), 'PPP') : '...'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(record.status)} className="capitalize">
                                                    {record.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {requestStatus ? (
                                                    <Badge variant={getRequestStatusVariant(requestStatus)} className="capitalize">
                                                        {requestStatus}
                                                    </Badge>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => setRequestingCorrection(record)}>
                                                        Request Correction
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No attendance records found for this course.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!requestingCorrection} onOpenChange={(open) => !open && setRequestingCorrection(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Attendance Correction</DialogTitle>
                        <DialogDescription>
                            Requesting correction for class on {requestingCorrection ? format(requestingCorrection.date.toDate(), 'PPP') : '...'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                           <Label htmlFor="reason">Reason for Correction</Label>
                           <Textarea
                             id="reason"
                             placeholder="Please provide a brief reason for the correction request (e.g., 'I was present but my attendance was not marked')."
                             value={reason}
                             onChange={(e) => setReason(e.target.value)}
                             disabled={isSubmitting}
                           />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" disabled={isSubmitting}>Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleRequestSubmit} disabled={isSubmitting || !reason.trim()}>
                            {isSubmitting ? 'Submitting...' : <><Send className="mr-2 h-4 w-4" /> Submit Request</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
