'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, doc, useDoc, useCollection, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
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
import { PlusCircle, Edit, Trash2, ArrowLeft, AlertCircle, Award, Sparkles, ShieldCheck } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
    DialogDescription,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

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
  semester: z.string().min(3, 'Semester is required.'),
  year: z.coerce.number().min(2020, 'Year must be valid.'),
  marks: z.coerce.number().min(0).max(100, 'Marks must be between 0 and 100.'),
  grade: z.string().min(1, 'Grade is required.'),
  published: z.boolean().default(false),
});

export default function CourseResultsPage() {
  const { profile: userProfile } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  
  const [openResultDialog, setOpenResultDialog] = useState(false);
  const [editingResult, setEditingResult] = useState<(Result & { studentName?: string }) | null>(null);

  const isFacultyOrAdmin = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  const enrollmentsQuery = useMemoFirebase(() => {
      if (!firestore || !courseId) return null;
      return query(collectionGroup(firestore, 'enrollments'), where('courseId', '==', courseId));
  }, [firestore, courseId]);
  const { data: enrollments, isLoading: areEnrollmentsLoading, error: enrollmentsError } = useCollection<any>(enrollmentsQuery);

  const studentIds = useMemo(() => {
      if (!enrollments) return [];
      return [...new Set(enrollments.map(e => e.studentId as string))];
  }, [enrollments]);

  const studentsQuery = useMemoFirebase(() => {
      if (!firestore || studentIds.length === 0) return null;
      return query(collection(firestore, 'users'), where('id', 'in', studentIds.slice(0, 30)));
  }, [firestore, studentIds]);
  const { data: enrolledStudents, isLoading: areStudentsLoading } = useCollection<UserProfile>(studentsQuery);
  
  const resultsQuery = useMemoFirebase(() => {
      if (!firestore || !courseId) return null;
      return query(collectionGroup(firestore, 'results'), where('courseId', '==', courseId));
  }, [firestore, courseId]);
  const { data: rawResults, isLoading: areResultsLoading, error: resultsError } = useCollection<Result>(resultsQuery);

  const courseResults = useMemo(() => {
      if (!rawResults || !enrolledStudents) return null;
      const studentMap = new Map(enrolledStudents.map(s => [s.id, s.name]));
      return rawResults.map(result => ({
          ...result,
          studentName: studentMap.get(result.studentId) || 'Unknown Student',
      })).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [rawResults, enrolledStudents]);

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

  const isLoading = isCourseLoading || areEnrollmentsLoading || areStudentsLoading || areResultsLoading;
  const isIndexError = 
    (enrollmentsError as any)?.code === 'failed-precondition' || (enrollmentsError as any)?.message?.toLowerCase().includes('index') ||
    (resultsError as any)?.code === 'failed-precondition' || (resultsError as any)?.message?.toLowerCase().includes('index');

  if (!isFacultyOrAdmin && userProfile) {
     return <div className="p-8 text-center"><Card className="glass-card border-none"><CardHeader><CardTitle>Unauthorized</CardTitle><CardDescription>Only faculty and administrators can manage academic results.</CardDescription></CardHeader></Card></div>
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
         <div className="academic-hero">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4">
                    <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.push('/results')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Registrar Hub
                    </Button>
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                            <Award className="h-3 w-3" /> Grade Ledger
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                            {isCourseLoading ? <Skeleton className="h-12 w-64" /> : course?.name}
                        </h1>
                        <p className="text-indigo-100/70 font-medium">Managing academic transcripts for {course?.code}.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleAddNewClick} disabled={isLoading} className="bg-white text-primary hover:bg-indigo-50 font-black rounded-xl h-12 px-8 shadow-xl shadow-black/20 uppercase tracking-widest text-[10px]">
                        <PlusCircle className="mr-2 h-4 w-4" /> Assign Grade
                    </Button>
                </div>
            </div>
        </div>

        {isIndexError && (
            <Alert variant="destructive" className="glass-card bg-destructive/10 border-destructive/20 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-black uppercase tracking-tight">Database Index Required</AlertTitle>
                <AlertDescription className="text-sm font-medium">
                    Please <strong>check your browser console (F12)</strong> and click the link to authorize search indexes for <code>enrollments</code> and <code>results</code>.
                </AlertDescription>
            </Alert>
        )}

        <Card className="glass-card border-none overflow-hidden shadow-2xl">
            <CardHeader className="bg-white/40 border-b border-white/20 p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tight">Institutional Transcripts</CardTitle>
              <CardDescription className="text-xs font-medium">Official grade distribution and student performance ledger.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Student Persona</TableHead>
                            <TableHead className="uppercase text-[10px] font-black tracking-widest">Term Period</TableHead>
                            <TableHead className="uppercase text-[10px] font-black tracking-widest">Points index</TableHead>
                            <TableHead className="uppercase text-[10px] font-black tracking-widest">Letter Grade</TableHead>
                            <TableHead className="uppercase text-[10px] font-black tracking-widest">Visibility</TableHead>
                            <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6} className="pl-8 pr-8"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>)
                        ) : courseResults && courseResults.length > 0 ? (
                            courseResults.map(result => (
                                <TableRow key={result.id} className="hover:bg-indigo-50/30 group transition-colors">
                                    <TableCell className="pl-8 font-black text-slate-800 uppercase tracking-tight">{result.studentName}</TableCell>
                                    <TableCell className="text-xs font-bold text-slate-500">{result.semester} {result.year}</TableCell>
                                    <TableCell className="font-black text-primary">{result.marks}%</TableCell>
                                    <TableCell>
                                        <Badge className={cn("rounded-lg font-black text-xs min-w-8 justify-center uppercase", result.marks >= 80 ? "bg-green-500" : result.marks < 50 ? "bg-destructive" : "bg-primary")}>
                                            {result.grade}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={result.published ? 'default' : 'secondary'} className="rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            {result.published ? 'Published' : 'Draft'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-sm" onClick={() => handleEditClick(result as any)}>
                                                <Edit className="h-4 w-4 text-indigo-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(result)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={6} className="text-center h-40 font-bold text-muted-foreground uppercase text-xs opacity-40">Awaiting grade assignments</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={openResultDialog} onOpenChange={setOpenResultDialog}>
            <DialogContent className="rounded-3xl max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editingResult ? 'Alter Grade Protocol' : 'New Grade Assignment'}</DialogTitle>
                    <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Module Assessment Entry</DialogDescription>
                </DialogHeader>
                {areStudentsLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
                <Form {...resultForm}>
                    <form onSubmit={resultForm.handleSubmit(onResultSubmit)} className="space-y-6 py-4">
                       <FormField control={resultForm.control} name="studentId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Enrolled Persona</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingResult}>
                                    <FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        {enrolledStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={resultForm.control} name="semester" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Academic Semester</FormLabel><FormControl><Input placeholder="Fall" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl></FormItem> )} />
                            <FormField control={resultForm.control} name="year" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Year</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={resultForm.control} name="marks" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Points (0-100)</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-black" /></FormControl></FormItem> )} />
                            <FormField control={resultForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Letter Index</FormLabel><FormControl><Input placeholder="A+" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-black" /></FormControl></FormItem> )} />
                        </div>
                        <FormField control={resultForm.control} name="published" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-indigo-50 p-6 bg-indigo-50/20">
                                <div className="space-y-0.5"><FormLabel className="text-xs font-black uppercase tracking-widest text-slate-800">Finalize & Publish</FormLabel><p className="text-[10px] font-medium text-slate-500">Enable to transmit result to the student transcript immediately.</p></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter className="pt-6">
                            <DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose>
                            <Button type="submit" disabled={resultForm.formState.isSubmitting} className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                {resultForm.formState.isSubmitting ? 'Syncing...' : 'Authorize Grade'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
