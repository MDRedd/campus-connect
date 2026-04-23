
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Calendar as CalendarIcon, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

    const stats = useMemo(() => {
        if (!attendanceRecords) return { attended: 0, total: 0, percentage: 0 };
        const attended = attendanceRecords.filter(r => r.status === 'present').length;
        const total = attendanceRecords.length;
        return { attended, total, percentage: total > 0 ? Math.round((attended / total) * 100) : 0 };
    }, [attendanceRecords]);

    const isLoading = isCourseLoading || areRecordsLoading || areRequestsLoading;

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
            attendanceDate: requestingCorrection.date,
            originalStatus: requestingCorrection.status,
        });
        
        toast({
            title: 'Request Submitted',
            description: 'Your faculty has been notified and will review your request.',
        });
        
        setIsSubmitting(false);
        setReason('');
        setRequestingCorrection(null);
    };

    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
            <div className="academic-hero">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Summary
                        </Button>
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                                <Clock className="h-3 w-3" /> Historical Presence
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                                {isCourseLoading ? <Skeleton className="h-12 w-64" /> : course?.name}
                            </h1>
                            <p className="text-indigo-100/70 font-medium">Detailed log and audit trail for {course?.code}.</p>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Term Attendance</span>
                        <span className={cn("text-5xl font-black tracking-tighter", stats.percentage < 75 ? "text-amber-300" : "text-white")}>{stats.percentage}%</span>
                        <span className="text-[9px] font-bold opacity-60 uppercase">{stats.attended} / {stats.total} Classes</span>
                    </div>
                </div>
            </div>
            
            <Card className="glass-card border-none overflow-hidden">
                <CardHeader className="bg-white/40 border-b border-white/20">
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Session Ledger</CardTitle>
                    <CardDescription className="text-xs font-medium">Verify every session presence. Mismarked? Initiate a correction protocol.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Date & Time</TableHead>
                                <TableHead className="uppercase text-[10px] font-black tracking-widest">Authorization Status</TableHead>
                                <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Ops / Request Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3} className="pl-8 pr-8"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                                    </TableRow>
                                ))
                            ) : attendanceRecords && attendanceRecords.length > 0 ? (
                                attendanceRecords.map(record => {
                                    const requestStatus = requestStatusMap.get(record.id);
                                    const isPresent = record.status === 'present';
                                    return (
                                        <TableRow key={record.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <TableCell className="pl-8 font-bold text-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg", isPresent ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                                                        <CalendarIcon className="h-4 w-4" />
                                                    </div>
                                                    {record.date ? format(record.date.toDate(), 'PPP') : '...'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("rounded-lg px-3 py-1 font-black uppercase text-[10px] tracking-widest", isPresent ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-red-500/10 text-red-600 border-red-500/20")}>
                                                    {isPresent ? <CheckCircle2 className="mr-1.5 h-3 w-3 inline" /> : <XCircle className="mr-1.5 h-3 w-3 inline" />}
                                                    {record.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                {requestStatus ? (
                                                    <Badge className={cn("rounded-lg px-3 py-1 font-black uppercase text-[10px] tracking-widest", 
                                                        requestStatus === 'pending' ? "bg-amber-500 text-white" : 
                                                        requestStatus === 'approved' ? "bg-green-600 text-white" : "bg-destructive text-white")}>
                                                        {requestStatus}
                                                    </Badge>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="rounded-xl font-bold uppercase text-[9px] tracking-widest opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-sm" onClick={() => setRequestingCorrection(record)}>
                                                        Request Correction
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-40 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <AlertCircle className="h-10 w-10" />
                                            <p className="font-black uppercase tracking-tighter text-sm">No records found for current term</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!requestingCorrection} onOpenChange={(open) => !open && setRequestingCorrection(null)}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Audit Challenge</DialogTitle>
                        <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">
                            Session Date: {requestingCorrection ? format(requestingCorrection.date.toDate(), 'PPP') : '...'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-indigo-50">
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">Provide evidentiary reason for correcting this record. Requests are reviewed by the module faculty within 48 hours.</p>
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="reason" className="font-black uppercase text-[10px] tracking-widest text-muted-foreground ml-1">Correction Rationale</Label>
                           <Textarea
                             id="reason"
                             placeholder="Describe the discrepancy..."
                             value={reason}
                             onChange={(e) => setReason(e.target.value)}
                             disabled={isSubmitting}
                             className="min-h-[120px] rounded-2xl bg-white/50 border-indigo-100 focus:ring-primary shadow-inner"
                           />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="ghost" disabled={isSubmitting}>Abort</Button>
                        </DialogClose>
                        <Button onClick={handleRequestSubmit} disabled={isSubmitting || !reason.trim()} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                            {isSubmitting ? 'Transmitting...' : <><Send className="mr-2 h-4 w-4" /> Submit Challenge</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
