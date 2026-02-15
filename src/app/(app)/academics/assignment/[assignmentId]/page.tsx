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
import { ArrowLeft, FileText, Pencil, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { generateSubmissionFeedback } from '@/ai/flows/generate-submission-feedback';

// Simplified types based on backend.json
type Course = { id: string; name: string; code: string; };
type Assignment = { id: string; courseId: string; title: string; description: string; deadline: string; facultyId: string; };
type Submission = { id: string; assignmentId: string; studentId: string; submissionDate: string; fileUrl: string; comments?: string; marksAwarded?: number; studentName?: string; courseId: string; facultyFeedback?: string; };
type UserProfile = { role: 'student' | 'faculty' | 'admin'; id: string; name: string };

const submissionSchema = z.object({
  fileUrl: z.string().url({ message: "Please enter a valid URL for your submission." }),
  comments: z.string().optional(),
});

const gradingSchema = z.object({
  marksAwarded: z.coerce.number().min(0, "Marks must be at least 0.").max(100, "Marks cannot exceed 100."),
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

    const isFaculty = userProfile?.role === 'faculty';

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
            studentName: studentMap.get(sub.studentId) || 'Unknown Student',
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

        toast({ title: 'Success', description: 'Assignment submitted successfully.' });
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

        toast({ title: 'Grade Saved', description: 'The marks and feedback have been updated.' });
        setOpenGradingDialog(false);
    }
    
    const handleGenerateFeedback = async () => {
        if (!assignment || !selectedSubmission) return;
    
        const marks = gradingForm.getValues('marksAwarded');
        if (marks === undefined || marks === null) {
            toast({
                variant: 'destructive',
                title: 'Marks required',
                description: 'Please enter marks before generating feedback.',
            });
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
            console.error("Error generating AI feedback:", e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not generate AI feedback.',
            });
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    if (!courseId) {
        return <div className="p-4"><Card><CardContent className="p-8">Error: Course ID is missing from the URL.</CardContent></Card></div>
    }
    
    const isLoading = isUserLoading || isAssignmentLoading || isCourseLoading;
    
    const pageTitle = assignment ? `Assignment: ${assignment.title}` : 'Loading Assignment...';
    const pageDescription = course ? `For course: ${course.name} (${course.code})` : 'Loading course details...';

    return (
        <div className="flex flex-col gap-6">
             <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            <div className="space-y-1">
                {isLoading ? (
                    <>
                        <Skeleton className="h-9 w-3/4" />
                        <Skeleton className="h-5 w-1/2" />
                    </>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                        <p className="text-muted-foreground">{pageDescription}</p>
                    </>
                )}
            </div>
            
            {isLoading ? <Skeleton className="h-48 w-full"/> : (
                <Card>
                    <CardHeader>
                        <CardTitle>Assignment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{assignment?.description}</p>
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm font-medium">Deadline: {assignment ? format(new Date(assignment.deadline), 'PPP') : '...'}</p>
                    </CardFooter>
                </Card>
            )}

            {/* Student View */}
            {!isFaculty && (
                isLoading || isMySubmissionLoading ? <Skeleton className="h-64 w-full" /> : (
                    mySubmission ? (
                        <Card>
                             <CardHeader><CardTitle>My Submission</CardTitle></CardHeader>
                             <CardContent>
                                <div className="grid gap-4 py-4 text-sm">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-muted-foreground">Submitted On</Label>
                                        <p className="col-span-3 font-medium">{format(new Date(mySubmission.submissionDate), 'Pp')}</p>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-muted-foreground">File</Label>
                                        <Button asChild variant="link" className="col-span-3 justify-start p-0 h-auto">
                                            <a href={mySubmission.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate">{mySubmission.fileUrl}</a>
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-4 items-start gap-4">
                                        <Label className="text-right pt-1 text-muted-foreground">Comments</Label>
                                        <p className="col-span-3">{mySubmission.comments || 'No comments provided.'}</p>
                                    </div>
                                    <hr className="col-span-4 my-2" />
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right text-muted-foreground">Grade</Label>
                                        <p className="col-span-3 font-bold text-lg">
                                            {mySubmission.marksAwarded !== undefined ? `${mySubmission.marksAwarded} / 100` : 'Not Graded Yet'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-4 items-start gap-4">
                                        <Label className="text-right pt-1 text-muted-foreground">Feedback</Label>
                                        <p className="col-span-3">{mySubmission.facultyFeedback || 'No feedback provided yet.'}</p>
                                    </div>
                                </div>
                             </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader><CardTitle>Submit Your Assignment</CardTitle></CardHeader>
                            <CardContent>
                                <Form {...submissionForm}>
                                    <form onSubmit={submissionForm.handleSubmit(onAddSubmission)} className="space-y-4">
                                        <FormField control={submissionForm.control} name="fileUrl" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Submission File URL</FormLabel>
                                                <FormControl><Input type="url" placeholder="https://docs.google.com/document/d/..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={submissionForm.control} name="comments" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Comments (Optional)</FormLabel>
                                                <FormControl><Textarea placeholder="Add any comments for your instructor..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <Button type="submit" disabled={submissionForm.formState.isSubmitting}>
                                            {submissionForm.formState.isSubmitting ? "Submitting..." : "Submit Assignment"}
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    )
                )
            )}

            {/* Faculty View */}
            {isFaculty && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Student Submissions</CardTitle>
                            <CardDescription>Review student submissions and award marks.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {areSubmissionsLoading || areStudentsLoading ? <Skeleton className="h-48 w-full" /> : (
                                submissionsWithStudentNames && submissionsWithStudentNames.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Submission</TableHead>
                                                <TableHead>Grade</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {submissionsWithStudentNames.map(sub => (
                                                <TableRow key={sub.id}>
                                                    <TableCell>{sub.studentName}</TableCell>
                                                    <TableCell>{format(new Date(sub.submissionDate), 'Pp')}</TableCell>
                                                    <TableCell><Button asChild variant="link" size="sm"><a href={sub.fileUrl} target="_blank" rel="noopener noreferrer">View File</a></Button></TableCell>
                                                    <TableCell>
                                                        {sub.marksAwarded !== undefined ? (
                                                            <span className="font-semibold">{`${sub.marksAwarded} / 100`}</span>
                                                        ) : (
                                                            <Badge variant="secondary">Not Graded</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenGradingDialog(sub)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            {sub.marksAwarded !== undefined ? 'Edit Grade' : 'Grade'}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                    <FileText className="h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No Submissions Yet</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">Student submissions will appear here once they are submitted.</p>
                                    </div>
                                )
                            )}
                        </CardContent>
                    </Card>

                    <Dialog open={openGradingDialog} onOpenChange={setOpenGradingDialog}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Grade Submission</DialogTitle>
                                <DialogDescription>
                                    For student: <span className="font-semibold">{selectedSubmission?.studentName}</span>
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...gradingForm}>
                                <form onSubmit={gradingForm.handleSubmit(onSaveGrade)} className="space-y-4">
                                    <FormField control={gradingForm.control} name="marksAwarded" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Marks (out of 100)</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={gradingForm.control} name="facultyFeedback" render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between items-center">
                                                <FormLabel>Feedback</FormLabel>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleGenerateFeedback}
                                                    disabled={isGeneratingFeedback || gradingForm.getValues('marksAwarded') === undefined}
                                                >
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    {isGeneratingFeedback ? 'Generating...' : 'Generate with AI'}
                                                </Button>
                                            </div>
                                            <FormControl><Textarea placeholder="Provide constructive feedback for the student..." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={gradingForm.formState.isSubmitting}>
                                            {gradingForm.formState.isSubmitting ? "Saving..." : "Save Grade"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </>
            )}

        </div>
    );
}
