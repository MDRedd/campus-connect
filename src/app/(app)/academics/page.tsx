'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, getDocs, query, DocumentData, where, addDoc } from 'firebase/firestore';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BookCopy, FileText, Download, Sparkles, PlusCircle, Lightbulb } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { summarizeCourseMaterials } from '@/ai/flows/summarize-course-materials';
import { generateStudyQuestions } from '@/ai/flows/generate-study-questions';
import { generatePersonalizedNotification } from '@/ai/flows/personalized-notification-generation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';

// Simplified types based on backend.json
type Enrollment = { courseId: string; };
type Course = { id: string; name: string; code: string; credits: number; };
type Assignment = { id: string; courseId: string; title: string; description: string; deadline: string; };
type StudyMaterial = { id: string; courseId: string; title: string; description: string; fileUrl: string; };
type UserProfile = { role: 'student' | 'faculty' | 'admin'; };
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

const submissionSchema = z.object({
  fileUrl: z.string().url({ message: "Please enter a valid URL for your submission." }),
  comments: z.string().optional(),
});


export default function AcademicsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questions, setQuestions] = useState('');
  const [questionsTitle, setQuestionsTitle] = useState('');
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);

  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);
  const [openMaterialDialog, setOpenMaterialDialog] = useState(false);
  const [openSubmissionDialog, setOpenSubmissionDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { courseName: string; courseCode: string; }) | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);
  const isFaculty = userProfile?.role === 'faculty';

  // Data fetching for all courses (needed for both roles to map IDs to names)
  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || isAuthUserLoading || !authUser) return null; // Wait for user
    return collection(firestore, 'courses');
  }, [firestore, isAuthUserLoading, authUser]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(allCoursesQuery);

  const allStudentsQuery = useMemoFirebase(() => {
    if (!firestore || !isFaculty) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'student'));
  }, [firestore, isFaculty]);
  const { data: allStudents, isLoading: areStudentsLoading } = useCollection<Student>(allStudentsQuery);

  // Role-specific data
  const [displayCourses, setDisplayCourses] = useState<Course[] | null>(null);
  const [assignments, setAssignments] = useState<(Assignment & { courseName: string; courseCode: string; })[] | null>(null);
  const [studyMaterials, setStudyMaterials] = useState<(StudyMaterial & { courseName: string; courseCode: string; })[] | null>(null);
  
  const [areDisplayCoursesLoading, setAreDisplayCoursesLoading] = useState(true);
  const [areAssignmentsLoading, setAreAssignmentsLoading] = useState(true);
  const [areStudyMaterialsLoading, setAreStudyMaterialsLoading] = useState(true);

  // Student enrollments
  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || isFaculty) return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser, isFaculty]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  // Effect to determine which courses to display based on role
  useEffect(() => {
    if (isUserProfileLoading || areCoursesLoading || (isFaculty === false && areEnrollmentsLoading)) return;

    const getCourses = async () => {
        setAreDisplayCoursesLoading(true);
        if (isFaculty) {
            // Logic for faculty
            if (!firestore || !authUser || !allCourses) {
                setDisplayCourses([]);
                setAreDisplayCoursesLoading(false);
                return;
            }
            try {
                const facultyCourseIds = new Set<string>();
                // This loop performs a query for each course. It is less efficient than a collection group query
                // but avoids the need for a composite index, which can be difficult to manage automatically.
                for (const course of allCourses) {
                    const timetablesForCourseQuery = query(
                        collection(firestore, 'courses', course.id, 'timetables'),
                        where('facultyId', '==', authUser.uid)
                    );
                    const timetableSnapshot = await getDocs(timetablesForCourseQuery);
                    if (!timetableSnapshot.empty) {
                        facultyCourseIds.add(course.id);
                    }
                }
                setDisplayCourses(allCourses.filter(course => facultyCourseIds.has(course.id)));
            } catch (error) {
                console.error("Error fetching faculty courses:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your courses.' });
                setDisplayCourses([]);
            }
        } else {
            // Logic for student
            if (!enrollments || !allCourses) {
                setDisplayCourses([]);
                return;
            };
            const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
            setDisplayCourses(allCourses.filter(course => enrolledCourseIds.has(course.id)));
        }
        setAreDisplayCoursesLoading(false);
    }
    getCourses();
    
  }, [isUserProfileLoading, isFaculty, firestore, authUser, allCourses, areCoursesLoading, enrollments, areEnrollmentsLoading, toast]);

  // Effect to fetch assignments and materials for the determined courses
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
        console.error("Error fetching academic data:", error);
        setAssignments([]);
        setStudyMaterials([]);
      } finally {
        setAreAssignmentsLoading(false);
        setAreStudyMaterialsLoading(false);
      }
    };

    fetchData();
  }, [firestore, displayCourses]);


  const handleSummarize = async (material: StudyMaterial & { courseName: string }) => {
    setIsSummarizing(true);
    setSummary('');
    setSummaryTitle(material.title);
    setShowSummaryDialog(true);
    try {
      const result = await summarizeCourseMaterials({
        courseName: material.courseName,
        material: `${material.title}\n\n${material.description}`,
      });
      setSummary(result.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuestions = async (material: StudyMaterial & { courseName: string }) => {
    setIsGeneratingQuestions(true);
    setQuestions('');
    setQuestionsTitle(material.title);
    setShowQuestionsDialog(true);
    try {
      const result = await generateStudyQuestions({
        courseMaterials: `${material.title}\n\n${material.description}`,
      });
      setQuestions(result.studyQuestions);
    } catch (error) {
      console.error('Error generating study questions:', error);
      setQuestions('Failed to generate study questions. Please try again.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };


  const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ resolver: zodResolver(assignmentSchema) });
  const materialForm = useForm<z.infer<typeof materialSchema>>({ resolver: zodResolver(materialSchema) });
  const submissionForm = useForm<z.infer<typeof submissionSchema>>({ resolver: zodResolver(submissionSchema) });

  async function onAddAssignment(values: z.infer<typeof assignmentSchema>) {
    if (!firestore) return;
    try {
        const courseRef = collection(firestore, 'courses', values.courseId, 'assignments');
        await addDoc(courseRef, {
            title: values.title,
            description: values.description,
            courseId: values.courseId,
            deadline: new Date(values.deadline).toISOString(),
        });
        toast({ title: 'Success', description: 'Assignment added.' });

        if (allStudents && allStudents.length > 0) {
            toast({ title: 'Generating Notifications', description: 'Sending alerts to enrolled students...' });
            const course = displayCourses?.find(c => c.id === values.courseId);

            // Run notification generation in the background
            (async () => {
                for (const student of allStudents) {
                    const enrollmentQuery = query(collection(firestore, 'users', student.id, 'enrollments'), where('courseId', '==', values.courseId));
                    const enrollmentSnapshot = await getDocs(enrollmentQuery);
                    if (!enrollmentSnapshot.empty) {
                        try {
                            const notificationResult = await generatePersonalizedNotification({
                                studentId: student.id,
                                updateType: 'assignmentDeadline',
                                details: `A new assignment "${values.title}" for course "${course?.name || 'Unknown Course'}" is due on ${format(new Date(values.deadline), 'PPP')}.`,
                            });
                            const notificationsRef = collection(firestore, 'users', student.id, 'notifications');
                            await addDoc(notificationsRef, {
                                userId: student.id,
                                message: notificationResult.notificationMessage,
                                read: false,
                                createdAt: new Date().toISOString(),
                            });
                        } catch (e) {
                            console.error(`Failed to generate or send notification for student ${student.id}`, e);
                        }
                    }
                }
            })();
        }

        setOpenAssignmentDialog(false);
        assignmentForm.reset();
    } catch (error) {
        console.error("Error adding assignment:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add assignment.' });
    }
  }
  
  async function onAddMaterial(values: z.infer<typeof materialSchema>) {
      if (!firestore || !authUser) return;
      try {
        const courseRef = collection(firestore, 'courses', values.courseId, 'study_materials');
        await addDoc(courseRef, {
            title: values.title,
            description: values.description,
            fileUrl: values.fileUrl,
            uploadedBy: authUser.uid,
            uploadDate: new Date().toISOString()
        });
        toast({ title: 'Success', description: 'Study material added.' });
        setOpenMaterialDialog(false);
        materialForm.reset();
      } catch (error) {
        console.error("Error adding material:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add study material.' });
      }
  }

  async function onAddSubmission(values: z.infer<typeof submissionSchema>) {
    if (!firestore || !authUser || !selectedAssignment) return;
    try {
        const submissionRef = collection(firestore, 'courses', selectedAssignment.courseId, 'assignments', selectedAssignment.id, 'submissions');
        await addDoc(submissionRef, {
            assignmentId: selectedAssignment.id,
            studentId: authUser.uid,
            submissionDate: new Date().toISOString(),
            fileUrl: values.fileUrl,
            comments: values.comments,
        });
        toast({ title: 'Success', description: 'Assignment submitted successfully.' });
        setOpenSubmissionDialog(false);
        submissionForm.reset();
    } catch (error) {
        console.error("Error submitting assignment:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not submit assignment.' });
    }
  }


  const isLoading = isAuthUserLoading || isUserProfileLoading || areDisplayCoursesLoading || areStudentsLoading;

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
                <Card key={course.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-lg"> <BookCopy className="h-6 w-6" /> </div>
                      <span className="flex-1">{course.name}</span>
                    </CardTitle>
                    <CardDescription>{course.code} | {course.credits} Credits</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex gap-2">
                    <Button size="sm">View Details</Button>
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
                {areAssignmentsLoading ? (
                    <Skeleton className="h-32 w-full" />
                ) : assignments && assignments.length > 0 ? (
                    assignments.map(assignment => (
                    <Card key={assignment.id}>
                        <CardHeader><CardTitle>{assignment.title}</CardTitle><CardDescription>{assignment.courseName} ({assignment.courseCode})</CardDescription></CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground">{assignment.description}</p></CardContent>
                        <CardFooter className="flex justify-between items-center">
                        <p className="text-sm font-medium">Deadline: {format(new Date(assignment.deadline), 'PPP')}</p>
                        {!isFaculty && (
                            <Button onClick={() => {
                                setSelectedAssignment(assignment);
                                setOpenSubmissionDialog(true);
                            }}>Submit</Button>
                        )}
                        </CardFooter>
                    </Card>
                    ))
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
                        <p className="text-sm text-muted-foreground">{material.courseName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleSummarize(material)} disabled={isSummarizing}><Sparkles className="mr-2 h-4 w-4" />Summarize</Button>
                            <Button variant="secondary" size="sm" onClick={() => handleGenerateQuestions(material)} disabled={isGeneratingQuestions}><Lightbulb className="mr-2 h-4 w-4" />Questions</Button>
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
      
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
            <DialogTitle>Summary for &quot;{summaryTitle}&quot;</DialogTitle>
            <DialogDescription>This summary was generated by AI. It may not be perfect, so please use it as a guide.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isSummarizing ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Generating summary...</span>
                </div>
            ) : (
                <p className="text-sm whitespace-pre-wrap">{summary}</p>
            )}
            </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
            <DialogTitle>Study Questions for &quot;{questionsTitle}&quot;</DialogTitle>
            <DialogDescription>These questions were generated by AI to help you study. Use them as a starting point.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isGeneratingQuestions ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Lightbulb className="h-4 w-4 animate-spin" />
                    <span>Generating questions...</span>
                </div>
            ) : (
                <p className="text-sm whitespace-pre-wrap">{questions}</p>
            )}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSubmissionDialog} onOpenChange={setOpenSubmissionDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Submit: {selectedAssignment?.title}</DialogTitle>
                <DialogDescription>Upload your assignment file and add any comments.</DialogDescription>
            </DialogHeader>
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
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={submissionForm.formState.isSubmitting}>
                            {submissionForm.formState.isSubmitting ? "Submitting..." : "Submit Assignment"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    