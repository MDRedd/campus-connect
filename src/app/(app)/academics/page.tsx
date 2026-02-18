'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, getDocs, query, where, doc, limit } from 'firebase/firestore';
import { format } from 'date-fns';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BookCopy, FileText, Download, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { generatePersonalizedNotification } from '@/ai/flows/personalized-notification-generation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';

// Simplified types
type Enrollment = { id: string; courseId: string; };
type Course = { id: string; name: string; code: string; credits: number; };
type Assignment = { id: string; courseId: string; title: string; description: string; deadline: string; facultyId: string; };
type Submission = { id: string; assignmentId: string; studentId: string; };
type StudyMaterial = { id: string; courseId: string; title: string; description: string; fileUrl: string; };
type Student = { id: string; name: string; };

const assignmentSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  deadline: z.string().min(1, 'Deadline is required.'),
});

const materialSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  fileUrl: z.string().url('Please enter a valid URL.'),
});

export default function AcademicsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);
  const [openMaterialDialog, setOpenMaterialDialog] = useState(false);

  const isFaculty = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

  // Enrollment data fetching
  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || isFaculty) return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser, isFaculty]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || isFaculty) return null;
    return collection(firestore, 'courses');
  }, [firestore, isFaculty]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

  const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

  const [displayCourses, setDisplayCourses] = useState<Course[] | null>(null);
  const [areDisplayCoursesLoading, setAreDisplayCoursesLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;

    if (isFaculty) {
        setDisplayCourses(facultyCourses);
        setAreDisplayCoursesLoading(areFacultyCoursesLoading);
    } else {
        const studentCoursesLoading = areEnrollmentsLoading || areAllCoursesLoading;
        setAreDisplayCoursesLoading(studentCoursesLoading);
        if (!studentCoursesLoading && enrollments && allCourses) {
            const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
            setDisplayCourses(allCourses.filter(course => enrolledCourseIds.has(course.id)));
        } else if (!studentCoursesLoading) {
            setDisplayCourses([]);
        }
    }
  }, [isUserLoading, isFaculty, areFacultyCoursesLoading, facultyCourses, areEnrollmentsLoading, areAllCoursesLoading, enrollments, allCourses]);

  const [assignments, setAssignments] = useState<(Assignment & { courseName: string; courseCode: string; })[] | null>(null);
  const [studyMaterials, setStudyMaterials] = useState<(StudyMaterial & { courseName: string; courseCode: string; })[] | null>(null);
  const [areAssignmentsLoading, setAreAssignmentsLoading] = useState(true);
  const [areStudyMaterialsLoading, setAreStudyMaterialsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !displayCourses) return;
    if (displayCourses.length === 0) {
        setAssignments([]);
        setStudyMaterials([]);
        setAreAssignmentsLoading(false);
        setAreStudyMaterialsLoading(false);
        return;
    }

    const fetchData = async () => {
      setAreAssignmentsLoading(true);
      setAreStudyMaterialsLoading(true);
      try {
        const allAssignments: (Assignment & { courseName: string; courseCode: string; })[] = [];
        const allMaterials: (StudyMaterial & { courseName: string; courseCode: string; })[] = [];
        
        for (const course of displayCourses) {
          const assignmentsQuery = query(collection(firestore, 'courses', course.id, 'assignments'));
          const assignmentsSnapshot = await getDocs(assignmentsQuery);
          assignmentsSnapshot.forEach((doc) => {
            allAssignments.push({ ...(doc.data() as Assignment), id: doc.id, courseName: course.name, courseCode: course.code });
          });

          const materialsQuery = query(collection(firestore, 'courses', course.id, 'study_materials'));
          const materialsSnapshot = await getDocs(materialsQuery);
          materialsSnapshot.forEach((doc) => {
            allMaterials.push({ ...(doc.data() as StudyMaterial), id: doc.id, courseName: course.name, courseCode: course.code });
          });
        }
        allAssignments.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        setAssignments(allAssignments);
        setStudyMaterials(allMaterials);
      } catch (error) {
        console.error("Error fetching assignments/materials:", error);
        setAssignments([]);
        setStudyMaterials([]);
      } finally {
        setAreAssignmentsLoading(false);
        setAreStudyMaterialsLoading(false);
      }
    };
    fetchData();
  }, [firestore, displayCourses]);

  const [mySubmissions, setMySubmissions] = useState<{[assignmentId: string]: Submission} | null>(null);
  const [areMySubmissionsLoading, setAreMySubmissionsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !authUser || isFaculty || !assignments) return;
    if (assignments.length === 0) {
        setMySubmissions({});
        setAreMySubmissionsLoading(false);
        return;
    }

    const fetchMySubmissions = async () => {
        setAreMySubmissionsLoading(true);
        const subsMap: {[assignmentId: string]: Submission} = {};
        try {
            for (const assignment of assignments) {
                const submissionsQuery = query(
                    collection(firestore, 'courses', assignment.courseId, 'assignments', assignment.id, 'submissions'),
                    where('studentId', '==', authUser.uid),
                    limit(1)
                );
                const querySnapshot = await getDocs(submissionsQuery);
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    subsMap[assignment.id] = { ...(doc.data() as Submission), id: doc.id };
                }
            }
            setMySubmissions(subsMap);
        } catch (error) {
            console.error("Error fetching student submissions:", error);
            setMySubmissions({});
        } finally {
            setAreMySubmissionsLoading(false);
        }
    };
    fetchMySubmissions();
  }, [firestore, authUser, isFaculty, assignments]);

  const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });
  const materialForm = useForm<z.infer<typeof materialSchema>>({ resolver: zodResolver(materialSchema) });

  const handleDropCourse = (courseId: string) => {
      if (!firestore || !authUser || !enrollments) return;
      if (!confirm('Are you sure you want to drop this course? All your submissions and records for this course will remain in the database, but you will no longer see it in your academics list.')) return;

      const enrollment = enrollments.find(e => e.courseId === courseId);
      if (enrollment) {
          deleteDocumentNonBlocking(doc(firestore, 'users', authUser.uid, 'enrollments', enrollment.id));
          toast({ title: 'Course Dropped', description: 'You have been un-enrolled from the course.' });
      }
  };

  async function onAddAssignment(values: z.infer<typeof assignmentSchema>) {
    if (!firestore || !authUser) return;
    
    const newAssignmentRef = await addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'assignments'), {
        title: values.title,
        description: values.description,
        courseId: values.courseId,
        deadline: new Date(values.deadline).toISOString(),
        facultyId: authUser.uid,
    });

    if (!newAssignmentRef) return;

    toast({ title: 'Success', description: 'Assignment added.' });
    setOpenAssignmentDialog(false);
    assignmentForm.reset();
  }
  
  function onAddMaterial(values: z.infer<typeof materialSchema>) {
      if (!firestore || !authUser) return;
      addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'study_materials'), {
          title: values.title,
          description: values.description,
          fileUrl: values.fileUrl,
          uploadedBy: authUser.uid,
          uploadDate: new Date().toISOString()
      });
      toast({ title: 'Success', description: 'Study material added.' });
      setOpenMaterialDialog(false);
      materialForm.reset();
  }

  const isLoading = isUserLoading || areDisplayCoursesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academics</h1>
        <p className="text-muted-foreground">
          {isFaculty ? 'Manage your courses, assignments, and study materials.' : 'View your courses, assignments, and study materials.'}
        </p>
      </div>
      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
        </TabsList>
        <TabsContent value="courses" className="mt-6">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => ( <Card key={i}><CardHeader><Skeleton className="h-24" /></CardHeader></Card> ))}
            </div>
          ) : displayCourses && displayCourses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayCourses.map((course) => (
                <Card key={course.id} className="flex flex-col group relative">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-lg"> <BookCopy className="h-6 w-6" /> </div>
                      <span className="flex-1">{course.name}</span>
                    </CardTitle>
                    <CardDescription>{course.code} | {course.credits} Credits</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex gap-2">
                    <Button size="sm" asChild className="flex-1"><Link href={`/courses/${course.id}`}>View Details</Link></Button>
                    {!isFaculty && (
                        <Button variant="ghost" size="icon" title="Drop Course" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDropCourse(course.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
             <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">{isFaculty ? 'You are not assigned to any courses.' : 'You are not enrolled in any courses.'}</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Assignments</CardTitle>
                  <CardDescription>{isFaculty ? 'Manage assignments for your courses.' : 'Submit your work before the deadline.'}</CardDescription>
                </div>
                {isFaculty && (
                    <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm" disabled={isLoading}><PlusCircle className="mr-2 h-4 w-4" /> Add Assignment</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add New Assignment</DialogTitle></DialogHeader>
                            <Form {...assignmentForm}>
                                <form onSubmit={assignmentForm.handleSubmit(onAddAssignment)} className="space-y-4">
                                <FormField control={assignmentForm.control} name="courseId" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Course</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                        <SelectContent>{displayCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={assignmentForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={assignmentForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={assignmentForm.control} name="deadline" render={({ field }) => ( <FormItem><FormLabel>Deadline</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">Add Assignment</Button></DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {areAssignmentsLoading || (!isFaculty && areMySubmissionsLoading) ? (
                    <Skeleton className="h-32 w-full" />
                ) : assignments && assignments.length > 0 ? (
                    assignments.map(assignment => {
                      const mySubmission = mySubmissions?.[assignment.id];
                      const buttonText = isFaculty ? 'View Submissions' : mySubmission ? 'View Submission' : 'Submit';
                      return (
                        <Card key={assignment.id}>
                            <CardHeader><CardTitle>{assignment.title}</CardTitle><CardDescription>{assignment.courseName} ({assignment.courseCode})</CardDescription></CardHeader>
                            <CardContent><p className="text-sm text-muted-foreground">{assignment.description}</p></CardContent>
                            <CardFooter className="flex justify-between items-center">
                            <p className="text-sm font-medium">Deadline: {format(new Date(assignment.deadline), 'PPP')}</p>
                            <Button asChild>
                                <Link href={`/academics/assignment/${assignment.id}?courseId=${assignment.courseId}`}>
                                    {buttonText}
                                </Link>
                            </Button>
                            </CardFooter>
                        </Card>
                      )
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Assignments... Yet!</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{isFaculty ? 'Add an assignment to get started.' : 'Check back here for updates on your coursework.'}</p>
                    </div>
                )}
              </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>Study Materials</CardTitle>
                    <CardDescription>{isFaculty ? 'Manage study materials for your courses.' : 'Download lecture notes and other resources.'}</CardDescription>
                </div>
                {isFaculty && (
                    <Dialog open={openMaterialDialog} onOpenChange={setOpenMaterialDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Material</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add New Study Material</DialogTitle></DialogHeader>
                            <Form {...materialForm}>
                                <form onSubmit={materialForm.handleSubmit(onAddMaterial)} className="space-y-4">
                                <FormField control={materialForm.control} name="courseId" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Course</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                        <SelectContent>{displayCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={materialForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={materialForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={materialForm.control} name="fileUrl" render={({ field }) => ( <FormItem><FormLabel>File URL</FormLabel><FormControl><Input type="url" placeholder="https://example.com/notes.pdf" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">Add Material</Button></DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {areStudyMaterialsLoading ? (
                    <Skeleton className="h-20 w-full" />
                ) : studyMaterials && studyMaterials.length > 0 ? (
                    studyMaterials.map(material => (
                    <Card key={material.id} className="flex items-center justify-between p-4">
                        <div className="flex-1">
                        <h4 className="font-semibold">{material.title}</h4>
                        <p className="text-sm text-muted-foreground">{material.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild><a href={material.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>
                        </div>
                    </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <Download className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Materials Available</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{isFaculty ? 'Upload study materials for your students.' : 'Your instructors will upload materials here.'}</p>
                    </div>
                )}
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
