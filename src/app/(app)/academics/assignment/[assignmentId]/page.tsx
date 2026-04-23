'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Pencil, Sparkles, TrendingUp, Clock, GraduationCap, ClipboardList, Send, ExternalLink, ShieldCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { generateSubmissionFeedback } from '@/ai/flows/generate-submission-feedback';
import { generateClassSummary } from '@/ai/flows/generate-class-summary';
import { cn } from '@/lib/utils';

// Types
type Course = { id: string; name: string; code: string; };
type Assignment = { id: string; courseId: string; title: string; description: string; deadline: string; facultyId: string; };
type Submission = { id: string; assignmentId: string; studentId: string; submissionDate: string; fileUrl: string; comments?: string; marksAwarded?: number; studentName?: string; courseId: string; facultyFeedback?: string; };
type UserProfile = { role: 'student' | 'faculty' | 'admin' | 'super-admin'; id: string; name: string };

const submissionSchema = z.object({
  fileUrl: z.string().url({ message: "Environmental error: Valid URI required for asset submission." }),
  comments: z.string().optional(),
});

const gradingSchema = z.object({
  marksAwarded: z.coerce.number().min(0, "Index range error: Minimum 0.").max(100, "Index range error: Maximum 100."),
  facultyFeedback: z.string().optional(),
});


export default function AssignmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user: authUser, profile: userProfile, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const assignmentId = params.assignmentId as string;
    const courseId = searchParams.get('courseId');

    const [openGradingDialog, setOpenGradingDialog] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [isGeneratingClassSummary, setIsGeneratingClassSummary] = useState(false);
    const [classSummary, setClassSummary] = useState('');
    const [showClassSummaryDialog, setShowClassSummaryDialog] = useState(false);

    const isFaculty = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

    const assignmentDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId || !assignmentId) return null;
        return doc(firestore, 'courses', courseId, 'assignments', assignmentId);
    }, [firestore, courseId, assignmentId]);
    const { data: assignment, isLoading: isAssignmentLoading } = useDoc<Assignment>(assignmentDocRef);
    
    const courseDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId) return null;
        return doc(firestore, 'courses', courseId);
    }, [firestore, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

    // --- Student-specific data ---
    const mySubmissionQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || isFaculty || !courseId || !assignmentId) return null;
        return query(
            collection(firestore, 'courses', courseId, 'assignments', assignmentId, 'submissions'),
            where('studentId', '==', authUser.uid),
            limit(1)
        );
    }, [firestore, authUser, isFaculty, courseId, assignmentId]);
    const { data: mySubmissionResult, isLoading: isMySubmissionLoading } = useCollection<Submission>(mySubmissionQuery);
    const mySubmission = useMemo(() => mySubmissionResult?.[0], [mySubmissionResult]);
    
    // --- Faculty-specific data ---
    const allSubmissionsQuery = useMemoFirebase(() => {
        if (!firestore || !isFaculty || !courseId || !assignmentId) return null;
        return collection(firestore, 'courses', courseId, 'assignments', assignmentId, 'submissions');
    }, [firestore, isFaculty, courseId, assignmentId]);
    const { data: allSubmissions, isLoading: areSubmissionsLoading } = useCollection<Submission>(allSubmissionsQuery);

    const allStudentsQuery = useMemoFirebase(() => {
        if (!firestore || !isFaculty) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'student'));
    }, [firestore, isFaculty]);
    const { data: allStudents, isLoading: areStudentsLoading } = useCollection<UserProfile>(allStudentsQuery);
    
    const submissionsWithStudentNames = useMemo(() => {
        if (!allSubmissions || !allStudents) return null;
        const studentMap = new Map(allStudents.map(s => [s.id, s.name]));
        return allSubmissions.map(sub => ({
            ...sub,
            studentName: studentMap.get(sub.studentId) || 'Unknown Persona',
        }));
    }, [allSubmissions, allStudents]);

    const submissionForm = useForm<z.infer<typeof submissionSchema>>({ resolver: zodResolver(submissionSchema) });
    const gradingForm = useForm<z.infer<typeof gradingSchema>>({ resolver: zodResolver(gradingSchema) });

    function onAddSubmission(values: z.infer<typeof submissionSchema>) {
        if (!firestore || !authUser || !assignment || !courseId) return;

        const submissionRef = collection(firestore, 'courses', courseId, 'assignments', assignment.id, 'submissions');
        addDocumentNonBlocking(submissionRef, {
            assignmentId: assignment.id,
            studentId: authUser.uid,
            submissionDate: new Date().toISOString(),
            fileUrl: values.fileUrl,
            comments: values.comments,
            courseId: courseId,
        });

        toast({ title: 'Protocol Success', description: 'Institutional asset submitted for review.' });
        submissionForm.reset();
    }

    const handleOpenGradingDialog = (submission: Submission) => {
        setSelectedSubmission(submission);
        gradingForm.reset({
            marksAwarded: submission.marksAwarded,
            facultyFeedback: submission.facultyFeedback || '',
        });
        setOpenGradingDialog(true);
    };

    function onSaveGrade(values: z.infer<typeof gradingSchema>) {
        if (!firestore || !selectedSubmission || !courseId) return;
        
        const subRef = doc(firestore, 'courses', courseId, 'assignments', selectedSubmission.assignmentId, 'submissions', selectedSubmission.id);
        updateDocumentNonBlocking(subRef, {
            marksAwarded: values.marksAwarded,
            facultyFeedback: values.facultyFeedback,
        });

        toast({ title: 'Ledger Updated', description: 'Grade parameters have been finalized.' });
        setOpenGradingDialog(false);
    }
    
    const handleGenerateFeedback = async () => {
        if (!assignment || !selectedSubmission) return;
    
        const marks = gradingForm.getValues('marksAwarded');
        if (marks === undefined || marks === null) {
            toast({ variant: 'destructive', title: 'Data Missing', description: 'Enter marks to synthesize AI feedback.' });
            return;
        }
    
        setIsGeneratingFeedback(true);
        try {
            const result = await generateSubmissionFeedback({
                assignmentTitle: assignment.title,
                assignmentDescription: assignment.description,
                marksAwarded: marks,
                studentName: selectedSubmission.studentName || 'Student',
            });
            gradingForm.setValue('facultyFeedback', result.feedback);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Flow Error', description: 'AI feedback synthesis failed.' });
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const handleGenerateClassInsights = async () => {
        if (!assignment || !submissionsWithStudentNames) return;
        if (submissionsWithStudentNames.length === 0) {
            toast({ title: "Null Dataset", description: "No submissions available for analysis." });
            return;
        }

        setIsGeneratingClassSummary(true);
        setClassSummary('');
        setShowClassSummaryDialog(true);

        try {
            const result = await generateClassSummary({
                assignmentTitle: assignment.title,
                submissions: submissionsWithStudentNames.map(s => ({
                    studentName: s.studentName!,
                    marks: s.marksAwarded,
                    comments: s.comments,
                    feedback: s.facultyFeedback,
                })),
            });
            setClassSummary(result.summary);
        } catch (e) {
            setClassSummary("Analysis Failure: Insufficient graded data or API timeout.");
        } finally {
            setIsGeneratingClassSummary(false);
        }
    };

    if (!courseId) {
        return <div className="p-8"><Card className="glass-card"><CardContent className="p-12 text-center uppercase font-black tracking-widest text-xs opacity-40">System Error: Course ID required for detail access.</CardContent></Card></div>
    }
    
    const isLoading = isUserLoading || isAssignmentLoading || isCourseLoading;
    
    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
             <div className="academic-hero">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Academics
                        </Button>
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                                <ClipboardList className="h-3 w-3" /> Module Assessment
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                                {isLoading ? <Skeleton className="h-12 w-64" /> : assignment?.title}
                            </h1>
                            <p className="text-indigo-100/70 font-medium">{course?.name} ({course?.code})</p>
                        </div>
                    </div>
                    {isFaculty && (
                        <Button onClick={handleGenerateClassInsights} disabled={isLoading || areSubmissionsLoading} className="bg-white text-primary hover:bg-indigo-50 font-black rounded-xl h-12 px-8 shadow-xl shadow-black/20 uppercase tracking-widest text-[10px]">
                            <TrendingUp className="mr-2 h-4 w-4" /> Class Performance (AI)
                        </Button>
                    )}
                </div>
            </div>
            
            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-8">
                    <Card className="glass-card border-none">
                        <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Scope & Requirements</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? <Skeleton className="h-32 w-full" /> : (
                                <p className="text-slate-600 leading-relaxed font-medium">{assignment?.description}</p>
                            )}
                            <div className="flex items-center gap-6 pt-6 border-t border-indigo-50/50">
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                                    <Clock className="h-4 w-4" />
                                    <span>Deadline: {assignment ? format(new Date(assignment.deadline), 'PPP') : '...'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    <GraduationCap className="h-4 w-4" />
                                    <span>Weight: 100 Points</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Faculty View: Submissions Table */}
                    {isFaculty && (
                        <Card className="glass-card border-none overflow-hidden">
                            <CardHeader className="bg-white/40 border-b border-white/20">
                                <CardTitle className="text-xl font-black uppercase tracking-tight">Identity Roster & Work</CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest">Audit student submissions and finalize grade indices.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {areSubmissionsLoading || areStudentsLoading ? <div className="p-8"><Skeleton className="h-48 w-full rounded-2xl" /></div> : (
                                    submissionsWithStudentNames && submissionsWithStudentNames.length > 0 ? (
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow>
                                                    <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Student</TableHead>
                                                    <TableHead className="uppercase text-[10px] font-black tracking-widest">Submission Date</TableHead>
                                                    <TableHead className="uppercase text-[10px] font-black tracking-widest">Grade Index</TableHead>
                                                    <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {submissionsWithStudentNames.map(sub => (
                                                    <TableRow key={sub.id} className="hover:bg-indigo-50/30 group transition-colors">
                                                        <TableCell className="pl-8 font-bold text-slate-700">{sub.studentName}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{format(new Date(sub.submissionDate), 'Pp')}</TableCell>
                                                        <TableCell>
                                                            {sub.marksAwarded !== undefined ? (
                                                                <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-3 py-1 rounded-lg">{sub.marksAwarded} / 100</Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="opacity-50 uppercase text-[9px] font-black tracking-widest">Pending</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-8">
                                                            <Button variant="ghost" size="sm" className="rounded-xl opacity-0 group-hover:opacity-100 font-black uppercase text-[10px] tracking-widest" onClick={() => handleOpenGradingDialog(sub)}>
                                                                <Pencil className="mr-2 h-3 w-3" /> Audit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-20 opacity-20 uppercase font-black tracking-widest text-xs">No active submissions found</div>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Student View: Submission Form or Result */}
                    {!isFaculty && (
                        isLoading || isMySubmissionLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : (
                            mySubmission ? (
                                <Card className="glass-card border-none bg-indigo-500 text-white overflow-hidden">
                                    <CardHeader className="bg-black/10"><CardTitle className="text-xs font-black uppercase tracking-widest opacity-80">Your Work Transcript</CardTitle></CardHeader>
                                    <CardContent className="pt-6 space-y-6">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Grade Index</p>
                                            <p className="text-5xl font-black tracking-tighter">
                                                {mySubmission.marksAwarded !== undefined ? `${mySubmission.marksAwarded}` : '--'}
                                                <span className="text-xl opacity-40 ml-1">/ 100</span>
                                            </p>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-white/10">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-black uppercase tracking-widest opacity-60">Status</span>
                                                <Badge className="bg-white/20 border-none text-white font-black uppercase text-[9px] tracking-widest">Submitted</Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Feedback</span>
                                                <p className="text-xs font-medium italic opacity-90 leading-relaxed">"{mySubmission.facultyFeedback || 'Awaiting instructor evaluation.'}"</p>
                                            </div>
                                            <Button asChild className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl h-12 font-black uppercase tracking-widest text-[10px] mt-4 shadow-xl shadow-black/20">
                                                <a href={mySubmission.fileUrl} target="_blank" rel="noopener noreferrer">Access Submission File <ExternalLink className="ml-2 h-3 w-3" /></a>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="glass-card border-none">
                                    <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Authorize Submission</CardTitle></CardHeader>
                                    <CardContent>
                                        <Form {...submissionForm}>
                                            <form onSubmit={submissionForm.handleSubmit(onAddSubmission)} className="space-y-6">
                                                <FormField control={submissionForm.control} name="fileUrl" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset URI (Google Drive/Share)</FormLabel>
                                                        <FormControl><Input type="url" placeholder="https://..." {...field} className="h-12 rounded-xl bg-white shadow-inner" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={submissionForm.control} name="comments" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contextual Comments</FormLabel>
                                                        <FormControl><Textarea placeholder="Notes for instructor..." {...field} className="rounded-xl bg-white shadow-inner min-h-[100px]" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <Button type="submit" disabled={submissionForm.formState.isSubmitting} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                                    {submissionForm.formState.isSubmitting ? "Transmitting..." : "Finalize Submission"}
                                                </Button>
                                            </form>
                                        </Form>
                                    </CardContent>
                                </Card>
                            )
                        )
                    )}

                    <Card className="glass-card border-none">
                        <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Compliance Notice</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-[10px] font-medium text-slate-400 leading-relaxed uppercase tracking-wider">All submissions are archived in the institutional blockchain. Late submissions are automatically flagged and may result in point deductions based on departmental policies.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Grading Dialog */}
            <Dialog open={openGradingDialog} onOpenChange={setOpenGradingDialog}>
                <DialogContent className="rounded-[2.5rem] max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Submission Audit</DialogTitle>
                        <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">
                            Persona: {selectedSubmission?.studentName}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...gradingForm}>
                        <form onSubmit={gradingForm.handleSubmit(onSaveGrade)} className="space-y-6 py-4">
                            <div className="grid grid-cols-1 gap-6">
                                <FormField control={gradingForm.control} name="marksAwarded" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Grade Index (0-100)</FormLabel>
                                        <FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner text-xl font-black" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={gradingForm.control} name="facultyFeedback" render={({ field }) => (
                                    <FormItem>
                                        <div className="flex justify-between items-center mb-2">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Synthesized Feedback</FormLabel>
                                            <Button type="button" variant="outline" size="sm" onClick={handleGenerateFeedback} disabled={isGeneratingFeedback} className="rounded-lg h-8 border-primary/20 text-primary font-black uppercase text-[8px] tracking-[0.2em] bg-primary/5">
                                                <Sparkles className="mr-1.5 h-3 w-3" />
                                                {isGeneratingFeedback ? 'Synthesizing...' : 'Synthesize with AI'}
                                            </Button>
                                        </div>
                                        <FormControl><Textarea placeholder="Provide evaluative rationale..." {...field} className="rounded-2xl bg-slate-50 border-none shadow-inner min-h-[150px]" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <DialogFooter className="pt-4">
                                <DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose>
                                <Button type="submit" disabled={gradingForm.formState.isSubmitting} className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                    {gradingForm.formState.isSubmitting ? "Finalizing..." : "Finalize Audit"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Class Summary Dialog */}
            <Dialog open={showClassSummaryDialog} onOpenChange={setShowClassSummaryDialog}>
                <DialogContent className="rounded-[2.5rem] max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Module Performance Insights</DialogTitle>
                        <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">AI Synthesis Engine v2.0</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 max-h-[60vh] overflow-y-auto">
                        {isGeneratingClassSummary ? (
                            <div className="flex flex-col items-center justify-center p-20 space-y-6">
                                <div className="bg-primary/5 p-10 rounded-full animate-pulse"><Sparkles className="h-12 w-12 text-primary" /></div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synthesizing Class Performance Metrics...</p>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 p-8 rounded-3xl border border-indigo-50">
                                <p className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">{classSummary}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowClassSummaryDialog(false)} className="rounded-xl w-full h-12 font-black uppercase tracking-widest text-[10px]">Close Analysis</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
