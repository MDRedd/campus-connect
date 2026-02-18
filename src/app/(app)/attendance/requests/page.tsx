
'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, serverTimestamp, doc } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Check, X, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { generatePersonalizedNotification } from '@/ai/flows/personalized-notification-generation';

// Types
type CorrectionRequest = {
  id: string;
  studentId: string;
  courseId: string;
  attendanceId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: any;
  attendanceDate: any;
  originalStatus: 'present' | 'absent';
};
type UserProfile = { id: string; name: string; };
type Course = { id: string; name: string; code: string; };

type FullRequest = CorrectionRequest & {
    studentName: string;
    courseCode: string;
};

export default function CorrectionRequestsPage() {
    const { user: authUser, profile: currentUserProfile, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    
    const [rejectingRequest, setRejectingRequest] = useState<FullRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'correctionRequests'), where('status', '==', 'pending'));
    }, [firestore]);
    const { data: requests, isLoading: areRequestsLoading } = useCollection<CorrectionRequest>(requestsQuery);

    const studentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: allStudents, isLoading: areStudentsLoading } = useCollection<UserProfile>(studentsQuery);
    
    const coursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);
    
    const fullRequests = useMemo<FullRequest[] | null>(() => {
        if (!requests || !allStudents || !allCourses) return null;
        const studentMap = new Map(allStudents.map(s => [s.id, s.name]));
        const courseMap = new Map(allCourses.map(c => [c.id, c.code]));
        return requests.map(req => ({
            ...req,
            studentName: studentMap.get(req.studentId) || 'Unknown Student',
            courseCode: courseMap.get(req.courseId) || 'N/A',
        })).sort((a,b) => a.requestedAt.toDate() - b.requestedAt.toDate());
    }, [requests, allStudents, allCourses]);
    
    const notifyStudent = async (request: FullRequest, newStatus: string, comments?: string) => {
        if (!firestore) return;
        try {
            const result = await generatePersonalizedNotification({
                userId: request.studentId,
                userName: request.studentName,
                updateType: 'generalAnnouncement',
                details: `ATTENDANCE REQUEST UPDATE: Your attendance correction request for class on ${format(request.attendanceDate.toDate(), 'PPP')} in course ${request.courseCode} has been ${newStatus.toUpperCase()}.${comments ? ` Faculty Comments: "${comments}"` : ''}`,
            });

            addDocumentNonBlocking(collection(firestore, 'users', request.studentId, 'notifications'), {
                userId: request.studentId,
                message: result.notificationMessage,
                read: false,
                createdAt: new Date().toISOString(),
                link: `/attendance/history/${request.courseId}`,
            });
        } catch (e) {
            console.error("Error sending notification to student:", e);
        }
    };

    const handleApprove = (request: FullRequest) => {
        if (!firestore || !authUser) return;

        const attendanceRef = doc(firestore, 'users', request.studentId, 'attendance', request.attendanceId);
        updateDocumentNonBlocking(attendanceRef, { status: 'present' });

        const requestRef = doc(firestore, 'correctionRequests', request.id);
        updateDocumentNonBlocking(requestRef, {
            status: 'approved',
            resolvedAt: serverTimestamp(),
            resolverId: authUser.uid,
        });

        notifyStudent(request, 'approved');
        toast({ title: 'Request Approved', description: `Attendance for ${request.studentName} marked as present.` });
    };

    const handleReject = () => {
        if (!firestore || !authUser || !rejectingRequest || !rejectionReason.trim()) return;

        const requestRef = doc(firestore, 'correctionRequests', rejectingRequest.id);
        updateDocumentNonBlocking(requestRef, {
            status: 'rejected',
            resolvedAt: serverTimestamp(),
            resolverId: authUser.uid,
            resolverComments: rejectionReason,
        });

        notifyStudent(rejectingRequest, 'rejected', rejectionReason);
        toast({ title: 'Request Rejected' });
        setRejectingRequest(null);
        setRejectionReason('');
    };

    const isLoading = isUserLoading || areRequestsLoading || areStudentsLoading || areCoursesLoading;
    const isFacultyOrAdmin = currentUserProfile?.role === 'faculty' || currentUserProfile?.role.includes('admin');

    if (!isUserLoading && !isFacultyOrAdmin) {
        return <div className="p-8"><Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader></Card></div>
    }

    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Attendance Correction Requests</CardTitle>
                    <CardDescription>Review and resolve pending student requests to amend attendance records.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Attendance Date</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : fullRequests && fullRequests.length > 0 ? (
                                fullRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{req.studentName}</TableCell>
                                        <TableCell>{req.courseCode}</TableCell>
                                        <TableCell>{format(req.attendanceDate.toDate(), 'PPP')}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={req.reason}>{req.reason}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" title="Approve" onClick={() => handleApprove(req)}><Check className="h-4 w-4 text-green-500" /></Button>
                                            <Button variant="ghost" size="icon" title="Reject" onClick={() => setRejectingRequest(req)}><X className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No pending correction requests.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Correction Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide a reason for rejecting the request from <span className="font-semibold">{rejectingRequest?.studentName}</span>. This will be visible to the student.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="rejection-reason">Reason for Rejection</Label>
                        <Textarea id="rejection-reason" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} disabled={!rejectionReason.trim()}>Reject</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
