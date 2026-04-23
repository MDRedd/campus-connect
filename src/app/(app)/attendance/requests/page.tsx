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
import { Check, X, ArrowLeft, ShieldCheck, ClipboardCheck, AlertCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
        })).sort((a,b) => (a.requestedAt?.toDate?.() || 0) - (b.requestedAt?.toDate?.() || 0));
    }, [requests, allStudents, allCourses]);
    
    const notifyStudent = async (request: FullRequest, newStatus: string, comments?: string) => {
        if (!firestore) return;
        try {
            const dateStr = request.attendanceDate?.toDate ? format(request.attendanceDate.toDate(), 'PPP') : 'N/A';
            const result = await generatePersonalizedNotification({
                userId: request.studentId,
                userName: request.studentName,
                updateType: 'generalAnnouncement',
                details: `ATTENDANCE REQUEST UPDATE: Your attendance correction request for class on ${dateStr} in course ${request.courseCode} has been ${newStatus.toUpperCase()}.${comments ? ` Faculty Comments: "${comments}"` : ''}`,
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
        return <div className="p-8"><Card className="glass-card border-none"><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader></Card></div>
    }

    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
             <div className="academic-hero">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Button>
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                                <ClipboardCheck className="h-3 w-3" /> Audit Registry
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">ATTENDANCE CHALLENGES</h1>
                            <p className="text-indigo-100/70 font-medium max-w-2xl">Review and resolve pending student requests to amend historical attendance records.</p>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Pending Audits</span>
                        <span className="text-5xl font-black tracking-tighter">{fullRequests?.length ?? 0}</span>
                        <span className="text-[9px] font-bold opacity-60 uppercase">Action Required</span>
                    </div>
                </div>
            </div>

            <Card className="glass-card border-none overflow-hidden shadow-2xl">
                <CardHeader className="bg-white/40 border-b border-white/20">
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Challenge Roster</CardTitle>
                    <CardDescription className="text-xs font-medium">Evaluate the evidentiary rationale provided for each correction request.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Student Identity</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Module Code</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Session Date</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Correction Rationale</TableHead>
                                <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Authorization</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={5} className="pl-8 pr-8"><Skeleton className="h-12 w-full rounded-xl" /></TableCell></TableRow>
                                ))
                            ) : fullRequests && fullRequests.length > 0 ? (
                                fullRequests.map(req => (
                                    <TableRow key={req.id} className="hover:bg-indigo-50/30 group transition-colors">
                                        <TableCell className="pl-8 font-black text-slate-800 uppercase tracking-tight">{req.studentName}</TableCell>
                                        <TableCell><Badge variant="outline" className="font-mono text-[10px] border-indigo-100 text-primary bg-primary/5">{req.courseCode}</Badge></TableCell>
                                        <TableCell className="text-xs font-bold text-slate-500">
                                            {req.attendanceDate ? format(req.attendanceDate.toDate(), 'PPP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate text-xs italic text-muted-foreground py-4" title={req.reason}>
                                            "{req.reason}"
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-green-50 hover:text-green-600 transition-all" title="Approve" onClick={() => handleApprove(req)}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-destructive transition-all" title="Reject" onClick={() => setRejectingRequest(req)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-60 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <ShieldCheck className="h-12 w-12" />
                                            <p className="font-black uppercase tracking-widest text-xs">No pending correction audits</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
                <AlertDialogContent className="rounded-3xl max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Deny Challenge Protocol</AlertDialogTitle>
                        <AlertDialogDescription className="font-bold text-destructive uppercase text-[10px] tracking-widest">
                            Target: {rejectingRequest?.studentName}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rejection Rationale</Label>
                            <Textarea 
                                id="rejection-reason" 
                                placeholder="State the reason for denial (visible to student)..." 
                                value={rejectionReason} 
                                onChange={e => setRejectionReason(e.target.value)} 
                                className="min-h-[120px] rounded-2xl bg-slate-50 border-none shadow-inner focus:ring-destructive"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="rounded-xl">Abort</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} disabled={!rejectionReason.trim()} className="rounded-xl h-12 px-8 bg-destructive hover:bg-destructive/90 font-black uppercase tracking-widest text-[10px]">
                            Finalize Rejection
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
