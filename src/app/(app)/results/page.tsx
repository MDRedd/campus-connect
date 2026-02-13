'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, getDocs, collectionGroup } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Download, GraduationCap, PlusCircle, Edit, Trash2 } from 'lucide-react';
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
  studentId?: string;
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
  role: 'student' | 'faculty' | 'admin';
};

type GroupedResults = {
  [key: string]: (Result & { courseName: string; courseCode: string })[];
};

const resultSchema = z.object({
  studentId: z.string().min(1, 'Please select a student.'),
  courseId: z.string().min(1, 'Please select a course.'),
  semester: z.string().min(3, 'Semester is required.'),
  year: z.coerce.number().min(2020, 'Year must be valid.'),
  marks: z.coerce.number().min(0).max(100, 'Marks must be between 0 and 100.'),
  grade: z.string().min(1, 'Grade is required.'),
  published: z.boolean().default(false),
});

export default function ResultsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [openResultDialog, setOpenResultDialog] = useState(false);
  const [editingResult, setEditingResult] = useState<(Result & { studentName?: string; courseCode?: string}) | null>(null);

  // --- Common ---
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || isAuthUserLoading || !authUser) return null;
    return collection(firestore, 'courses');
  }, [firestore, isAuthUserLoading, authUser]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);
  
  // --- Student Specific ---
  const studentResultsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return query(collection(firestore, 'users', authUser.uid, 'results'), where('published', '==', true));
  }, [firestore, authUser, userProfile]);
  const { data: studentResults, isLoading: areStudentResultsLoading } = useCollection<Result>(studentResultsQuery);

  const groupedResults = useMemo<GroupedResults | null>(() => {
    if (!studentResults || !allCourses) return null;
    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    return studentResults.reduce((acc, result) => {
      const semesterKey = `${result.semester} ${result.year}`;
      if (!acc[semesterKey]) {
        acc[semesterKey] = [];
      }
      const course = courseMap.get(result.courseId);
      acc[semesterKey].push({
        ...result,
        courseName: course?.name || 'Unknown Course',
        courseCode: course?.code || 'N/A',
      });
      return acc;
    }, {} as GroupedResults);
  }, [studentResults, allCourses]);

  const sortedSemesterKeys = useMemo(() => {
    if (!groupedResults) return null;
    return Object.keys(groupedResults).sort((a, b) => {
      const [semA, yearA] = a.split(' ');
      const [semB, yearB] = b.split(' ');
      if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
      return semB.localeCompare(semA);
    });
  }, [groupedResults]);

  // --- Faculty Specific ---
  const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
  const [areFacultyCoursesLoading, setAreFacultyCoursesLoading] = useState(true);

  const allStudentsQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile || userProfile.role !== 'faculty') return null;
    return query(collection(firestore, 'users'), where('role', '==', 'student'));
  }, [firestore, userProfile]);
  const { data: allStudents, isLoading: areStudentsLoading } = useCollection<UserProfile>(allStudentsQuery);
  
    const [facultyResults, setFacultyResults] = useState<(Result & { studentName: string; courseCode: string; })[] | null>(null);
    const [areFacultyResultsLoading, setAreFacultyResultsLoading] = useState(true);
  
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'faculty' || !firestore || !authUser || areAllCoursesLoading || !allCourses) return;
    
    const fetchFacultyCourses = async () => {
      setAreFacultyCoursesLoading(true);
      try {
        const timetablesQuery = query(
            collectionGroup(firestore, 'timetables'),
            where('facultyId', '==', authUser.uid)
        );
        const timetableSnapshot = await getDocs(timetablesQuery);
        const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];
        if (facultyCourseIds.length > 0) {
            setFacultyCourses(allCourses.filter(course => facultyCourseIds.includes(course.id)));
        } else {
            setFacultyCourses([]);
        }
      } catch (error) {
        console.error("Error fetching faculty courses:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your courses.' });
        setFacultyCourses([]);
      } finally {
        setAreFacultyCoursesLoading(false);
      }
    };
    fetchFacultyCourses();
  }, [firestore, authUser, allCourses, areAllCoursesLoading, userProfile, toast]);

    useEffect(() => {
        if (userProfile?.role !== 'faculty' || !firestore || areFacultyCoursesLoading || areStudentsLoading) return;
        if (!facultyCourses || !allStudents) {
            setAreFacultyResultsLoading(false);
            return;
        }
        if (facultyCourses.length === 0) {
            setFacultyResults([]);
            setAreFacultyResultsLoading(false);
            return;
        }

        const fetchResults = async () => {
            setAreFacultyResultsLoading(true);
            const results: (Result & { studentName: string; courseCode: string; })[] = [];
            const studentMap = new Map(allStudents.map(s => [s.id, s.name]));
            const courseMap = new Map(facultyCourses.map(c => [c.id, c.code]));

            try {
                const resultsQuery = query(collectionGroup(firestore, 'results'), where('courseId', 'in', facultyCourses.map(c => c.id)));
                const querySnapshot = await getDocs(resultsQuery);
                
                querySnapshot.forEach(docSnap => {
                    const data = docSnap.data() as Result;
                    const parentPath = docSnap.ref.parent.parent;
                    if (parentPath) {
                        results.push({
                            ...data,
                            id: docSnap.id,
                            studentId: parentPath.id,
                            studentName: studentMap.get(parentPath.id) || 'Unknown Student',
                            courseCode: courseMap.get(data.courseId) || 'N/A'
                        });
                    }
                });
                results.sort((a, b) => b.year - a.year || a.semester.localeCompare(b.semester));
                setFacultyResults(results);
            } catch (error) {
                console.error("Error fetching faculty results:", error);
                setFacultyResults([]);
            } finally {
                setAreFacultyResultsLoading(false);
            }
        }
        fetchResults();

  }, [firestore, facultyCourses, allStudents, userProfile, areFacultyCoursesLoading, areStudentsLoading]);


  const resultForm = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
        year: new Date().getFullYear(),
        published: false
    }
  });

  const handleAddNewClick = () => {
    setEditingResult(null);
    resultForm.reset({
        year: new Date().getFullYear(),
        published: false
    });
    setOpenResultDialog(true);
  };
  
  const handleEditClick = (result: Result & { studentName: string; courseCode: string }) => {
    setEditingResult(result);
    resultForm.reset({
        studentId: result.studentId,
        courseId: result.courseId,
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
    if (!firestore) return;

    if (editingResult && editingResult.id && editingResult.studentId) {
        const resultRef = doc(firestore, 'users', editingResult.studentId, 'results', editingResult.id);
        updateDocumentNonBlocking(resultRef, values);
        toast({ title: 'Success', description: 'Result updated.' });
    } else {
        const resultsRef = collection(firestore, 'users', values.studentId, 'results');
        addDocumentNonBlocking(resultsRef, values);
        toast({ title: 'Success', description: 'Result added successfully.' });
    }
    setOpenResultDialog(false);
    setEditingResult(null);
    resultForm.reset();
  }

  const isLoading = isAuthUserLoading || isUserProfileLoading || areAllCoursesLoading;
  
  if (isLoading) {
    return (
        <Card className="w-full">
            <CardHeader>
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    )
  }

  // FACULTY VIEW
  if (userProfile?.role === 'faculty') {
    const isFacultyDataLoading = areFacultyCoursesLoading || areStudentsLoading || areFacultyResultsLoading;
    return (
        <Card className="w-full">
            <CardHeader className="flex-row justify-between items-start">
              <div>
                <CardTitle className="text-3xl font-bold">Manage Results</CardTitle>
                <CardDescription>Add, edit, and publish results for students in your courses.</CardDescription>
              </div>
              <Dialog open={openResultDialog} onOpenChange={setOpenResultDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick}><PlusCircle className="mr-2 h-4 w-4" /> {editingResult ? 'Edit Result' : 'Add Result'}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingResult ? 'Edit Result' : 'Add New Result'}</DialogTitle></DialogHeader>
                    {areFacultyCoursesLoading || areStudentsLoading ? <Skeleton className="h-96"/> : (
                    <Form {...resultForm}>
                        <form onSubmit={resultForm.handleSubmit(onResultSubmit)} className="space-y-4">
                           <FormField control={resultForm.control} name="studentId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Student</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingResult}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger></FormControl>
                                    <SelectContent>{allStudents?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={resultForm.control} name="courseId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Course</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingResult}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                    <SelectContent>{facultyCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
                            <TableHead>Course</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isFacultyDataLoading ? (
                            [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>)
                        ) : facultyResults && facultyResults.length > 0 ? (
                            facultyResults.map(result => (
                                <TableRow key={result.id}>
                                    <TableCell>{result.studentName}</TableCell>
                                    <TableCell>{result.courseCode}</TableCell>
                                    <TableCell>{result.semester} {result.year}</TableCell>
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
                            <TableRow><TableCell colSpan={6} className="text-center h-24">No results found for your courses.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
  }

  // STUDENT VIEW
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Semester Results</CardTitle>
        <CardDescription>
          View your semester results and download report cards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {areStudentResultsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : sortedSemesterKeys && sortedSemesterKeys.length > 0 ? (
          <Accordion type="single" collapsible defaultValue={sortedSemesterKeys[0]} className="w-full">
            {sortedSemesterKeys.map(semesterKey => (
              <AccordionItem value={semesterKey} key={semesterKey}>
                <AccordionTrigger className="text-xl font-semibold">
                  {semesterKey}
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course Code</TableHead>
                        <TableHead>Course Name</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedResults?.[semesterKey].map(result => (
                        <TableRow key={result.courseId}>
                          <TableCell className="font-medium">{result.courseCode}</TableCell>
                          <TableCell>{result.courseName}</TableCell>
                          <TableCell className="text-right">{result.marks}</TableCell>
                          <TableCell className="text-right font-bold">{result.grade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <GraduationCap className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Results Published</h3>
                <p className="mt-1 text-sm text-muted-foreground">Your results will appear here once they are published.</p>
            </div>
        )}
      </CardContent>
      {sortedSemesterKeys && sortedSemesterKeys.length > 0 && (
        <CardFooter>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Download All Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
