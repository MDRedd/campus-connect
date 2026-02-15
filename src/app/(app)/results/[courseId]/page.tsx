'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, doc, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
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
import { PlusCircle, Edit, Trash2, ArrowLeft } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type Result = {
  id?: string;
  studentId: string;
  courseId: string;
  semester: string;
  year: number;
  marks: number;
  grade: string;
  published: boolean;
};

type Course = {
  id: string;
  name: string;
  code: string;
};

type UserProfile = {
  id: string;
  name: string;
};

const resultSchema = z.object({
  studentId: z.string().min(1, 'Please select a student.'),
  // courseId is removed from form, will be added from URL
  semester: z.string().min(3, 'Semester is required.'),
  year: z.coerce.number().min(2020, 'Year must be valid.'),
  marks: z.coerce.number().min(0).max(100, 'Marks must be between 0 and 100.'),
  grade: z.string().min(1, 'Grade is required.'),
  published: z.boolean().default(false),
});

export default function CourseResultsPage() {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  
  const [openResultDialog, setOpenResultDialog] = useState(false);
  const [editingResult, setEditingResult] = useState<(Result & { studentName?: string }) | null>(null);

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[] | null>(null);
  const [areStudentsLoading, setAreStudentsLoading] = useState(true);

  const [courseResults, setCourseResults] = useState<(Result & { studentName: string })[] | null>(null);
  const [areResultsLoading, setAreResultsLoading] = useState(true);

  // 1. Fetch enrolled students
    useEffect(() => {
        if (!firestore || !courseId) return;
        const fetchStudents = async () => {
            setAreStudentsLoading(true);
            try {
                const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', '==', courseId));
                const snapshot = await getDocs(enrollmentsQuery);
                const studentIds = snapshot.docs.map(d => d.data().studentId as string);

                if (studentIds.length > 0) {
                    const studentProfiles: UserProfile[] = [];
                    for (let i = 0; i < studentIds.length; i += 30) {
                        const chunk = studentIds.slice(i, i + 30);
                        const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                        const studentsSnapshot = await getDocs(studentsQuery);
                        studentsSnapshot.forEach(doc => studentProfiles.push(doc.data() as UserProfile));
                    }
                    setEnrolledStudents(studentProfiles);
                } else {
                    setEnrolledStudents([]);
                }
            } catch (e) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'enrollments or users', operation: 'list'}));
                setEnrolledStudents([]);
            } finally {
                setAreStudentsLoading(false);
            }
        };
        fetchStudents();
    }, [firestore, courseId]);
  
  // 2. Fetch results for this course
  useEffect(() => {
    if (!firestore || !courseId || !enrolledStudents) {
        if (!areStudentsLoading) setAreResultsLoading(false);
        return;
    }
    
    const fetchResults = async () => {
        setAreResultsLoading(true);
        const studentMap = new Map(enrolledStudents.map(s => [s.id, s.name]));
        try {
            const resultsQuery = query(collectionGroup(firestore, 'results'), where('courseId', '==', courseId));
            const snapshot = await getDocs(resultsQuery);
            const resultsData = snapshot.docs.map(d => {
                const studentId = d.ref.parent.parent!.id;
                return {
                    id: d.id,
                    studentId,
                    studentName: studentMap.get(studentId) || 'Unknown Student',
                    ...(d.data() as Omit<Result, 'studentId'>),
                };
            });
            resultsData.sort((a,b) => a.studentName.localeCompare(b.studentName));
            setCourseResults(resultsData);
        } catch (e) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'results', operation: 'list'}));
            setCourseResults([]);
        } finally {
            setAreResultsLoading(false);
        }
    }
    fetchResults();

  }, [firestore, courseId, enrolledStudents, areStudentsLoading]);

  const resultForm = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: { year: new Date().getFullYear(), published: false }
  });

  const handleAddNewClick = () => {
    setEditingResult(null);
    resultForm.reset({ year: new Date().getFullYear(), published: false });
    setOpenResultDialog(true);
  };
  
  const handleEditClick = (result: Result & { studentName: string }) => {
    setEditingResult(result);
    resultForm.reset({
        studentId: result.studentId,
        semester: result.semester,
        year: result.year,
        marks: result.marks,
        grade: result.grade,
        published: result.published,
    });
    setOpenResultDialog(true);
  };

  const handleDelete = (result: Result) => {
    if (!firestore || !result.id || !result.studentId) return;
    if (!confirm('Are you sure you want to delete this result? This action cannot be undone.')) return;
    const resultRef = doc(firestore, 'users', result.studentId, 'results', result.id);
    deleteDocumentNonBlocking(resultRef);
    toast({ title: 'Success', description: 'Result deleted.' });
  };

  function onResultSubmit(values: z.infer<typeof resultSchema>) {
    if (!firestore || !courseId) return;
    
    const dataToSubmit = { ...values, courseId };

    if (editingResult && editingResult.id && editingResult.studentId) {
        const resultRef = doc(firestore, 'users', editingResult.studentId, 'results', editingResult.id);
        updateDocumentNonBlocking(resultRef, dataToSubmit);
        toast({ title: 'Success', description: 'Result updated.' });
    } else {
        const resultsRef = collection(firestore, 'users', values.studentId, 'results');
        addDocumentNonBlocking(resultsRef, dataToSubmit);
        toast({ title: 'Success', description: 'Result added successfully.' });
    }
    setOpenResultDialog(false);
    setEditingResult(null);
    resultForm.reset();
  }

  const isLoading = isCourseLoading || areStudentsLoading || areResultsLoading;

  return (
    <div className="flex flex-col gap-6">
        <Button variant="outline" size="sm" className="w-fit" onClick={() => router.push('/results')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
        </Button>
        <Card className="w-full">
            <CardHeader className="flex-row justify-between items-start">
              <div>
                <CardTitle className="text-3xl font-bold">
                    {isCourseLoading ? <Skeleton className="h-9 w-64" /> : `Results for ${course?.name}`}
                </CardTitle>
                <CardDescription>
                    {isCourseLoading ? <Skeleton className="h-5 w-48 mt-1" /> : `Add, edit, and publish results for ${course?.code}.`}
                </CardDescription>
              </div>
              <Dialog open={openResultDialog} onOpenChange={setOpenResultDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick} disabled={isLoading}><PlusCircle className="mr-2 h-4 w-4" /> {editingResult ? 'Edit Result' : 'Add Result'}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingResult ? 'Edit Result' : 'Add New Result'}</DialogTitle></DialogHeader>
                    {areStudentsLoading ? <Skeleton className="h-96"/> : (
                    <Form {...resultForm}>
                        <form onSubmit={resultForm.handleSubmit(onResultSubmit)} className="space-y-4">
                           <FormField control={resultForm.control} name="studentId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Student</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingResult}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger></FormControl>
                                    <SelectContent>{enrolledStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={resultForm.control} name="semester" render={({ field }) => ( <FormItem><FormLabel>Semester</FormLabel><FormControl><Input placeholder="e.g., Fall" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={resultForm.control} name="year" render={({ field }) => ( <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={resultForm.control} name="marks" render={({ field }) => ( <FormItem><FormLabel>Marks</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={resultForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><FormControl><Input placeholder="e.g., A+" {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={resultForm.control} name="published" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5"><FormLabel>Publish Result</FormLabel></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />
                           <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={resultForm.formState.isSubmitting}>{resultForm.formState.isSubmitting ? 'Saving...' : 'Save Result'}</Button></DialogFooter>
                        </form>
                    </Form>
                    )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>)
                        ) : courseResults && courseResults.length > 0 ? (
                            courseResults.map(result => (
                                <TableRow key={result.id}>
                                    <TableCell>{result.studentName}</TableCell>
                                    <TableCell>{result.semester} {result.year}</TableCell>
                                    <TableCell>{result.marks}</TableCell>
                                    <TableCell className="font-bold">{result.grade}</TableCell>
                                    <TableCell>
                                        <Badge variant={result.published ? 'default' : 'secondary'}>
                                            {result.published ? 'Published' : 'Draft'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(result)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(result)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={6} className="text-center h-24">No results found for this course.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
