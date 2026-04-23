'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
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
import { BookCopy, FileText, Download, PlusCircle, Trash2, Library, Clock, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
type StudyMaterial = { id: string; courseId: string; title: string; description: string; fileUrl: string; };

const assignmentSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional().default(''),
  deadline: z.string().min(1, 'Deadline is required.'),
});

const materialSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional().default(''),
  fileUrl: z.string().url('Please enter a valid URL.'),
});

export default function AcademicsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);
  const [openMaterialDialog, setOpenMaterialDialog] = useState(false);

  const isFaculty = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

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
        console.error("Error fetching academic assets:", error);
        setAssignments([]);
        setStudyMaterials([]);
      } finally {
        setAreAssignmentsLoading(false);
        setAreStudyMaterialsLoading(false);
      }
    };
    fetchData();
  }, [firestore, displayCourses]);

  const [mySubmissions, setMySubmissions] = useState<{[assignmentId: string]: any} | null>(null);
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
        const subsMap: {[assignmentId: string]: any} = {};
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
                    subsMap[assignment.id] = { ...(doc.data()), id: doc.id };
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

  const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({ 
    resolver: zodResolver(assignmentSchema),
    defaultValues: { courseId: '', title: '', description: '', deadline: '' }
  });
  const materialForm = useForm<z.infer<typeof materialSchema>>({ 
    resolver: zodResolver(materialSchema),
    defaultValues: { courseId: '', title: '', description: '', fileUrl: '' }
  });

  const handleDropCourse = (courseId: string) => {
      if (!firestore || !authUser || !enrollments) return;
      if (!confirm('Drop course? Official records will be preserved.')) return;

      const enrollment = enrollments.find(e => e.courseId === courseId);
      if (enrollment) {
          deleteDocumentNonBlocking(doc(firestore, 'users', authUser.uid, 'enrollments', enrollment.id));
          toast({ title: 'Course Dropped' });
      }
  };

  async function onAddAssignment(values: z.infer<typeof assignmentSchema>) {
    if (!firestore || !authUser) return;
    addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'assignments'), {
        ...values,
        deadline: new Date(values.deadline).toISOString(),
        facultyId: authUser.uid,
    });
    toast({ title: 'Published', description: 'Academic assignment live.' });
    setOpenAssignmentDialog(false);
    assignmentForm.reset();
  }
  
  function onAddMaterial(values: z.infer<typeof materialSchema>) {
      if (!firestore || !authUser) return;
      addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'study_materials'), {
          ...values,
          uploadedBy: authUser.uid,
          uploadDate: new Date().toISOString()
      });
      toast({ title: 'Synced', description: 'Asset available to students.' });
      setOpenMaterialDialog(false);
      materialForm.reset();
  }

  const isLoading = isUserLoading || areDisplayCoursesLoading;

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <Library className="h-3 w-3" /> Academic Ledger
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">ACADEMICS</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">
                      {isFaculty ? 'Manage learning assets, assignments, and curriculum progress.' : 'Access your courses, submit work, and engage with study materials.'}
                  </p>
              </div>
              <div className="hidden lg:block opacity-20"><BookCopy className="h-32 w-32" /></div>
          </div>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 h-12 p-1 bg-white/50 backdrop-blur-sm border rounded-xl">
          <TabsTrigger value="courses" className="rounded-lg">Courses</TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-lg">Assignments</TabsTrigger>
          <TabsTrigger value="materials" className="rounded-lg">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-8">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => ( <Skeleton key={i} className="h-48 rounded-[2rem]" /> ))}
            </div>
          ) : displayCourses && displayCourses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayCourses.map((course) => (
                <Card key={course.id} className="glass-card border-none flex flex-col group overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div className="bg-primary/5 text-primary p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500"><BookCopy className="h-6 w-6" /></div>
                        {!isFaculty && <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDropCourse(course.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                    <div className="pt-4 space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight uppercase leading-none">{course.name}</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60">{course.code} • {course.credits} Credits</CardDescription>
                    </div>
                  </CardHeader>
                  <CardFooter className="mt-auto pt-4">
                    <Button asChild className="w-full rounded-xl"><Link href={`/courses/${course.id}`}>Enter learning Node <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : <div className="text-center py-20 opacity-20 font-black uppercase text-xs">No active modules found</div>}
        </TabsContent>

        <TabsContent value="assignments" className="mt-8">
            <Card className="glass-card border-none">
              <CardHeader className="flex flex-row items-center justify-between pb-8 border-b border-indigo-50/50">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tight">ACTIVE ASSIGNMENTS</CardTitle>
                  <CardDescription className="text-xs font-medium">Core assessments required for academic standing.</CardDescription>
                </div>
                {isFaculty && (
                    <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
                        <DialogTrigger asChild><Button onClick={() => assignmentForm.reset()} className="rounded-xl"><PlusCircle className="mr-2 h-4 w-4" /> New Assignment</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">Publish New Assignment</DialogTitle></DialogHeader>
                            <Form {...assignmentForm}><form onSubmit={assignmentForm.handleSubmit(onAddAssignment)} className="space-y-4 pt-4">
                                <FormField control={assignmentForm.control} name="courseId" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Course</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{displayCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select></FormItem>
                                )} />
                                <FormField control={assignmentForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Headline</FormLabel><FormControl><Input {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <FormField control={assignmentForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Scope</FormLabel><FormControl><Textarea {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <FormField control={assignmentForm.control} name="deadline" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Deadline</FormLabel><FormControl><Input type="date" {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <DialogFooter className="pt-6"><Button type="submit" className="rounded-xl px-10 h-12 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Authorize & Publish</Button></DialogFooter>
                            </form></Form>
                        </DialogContent>
                    </Dialog>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 mt-6">
                {areAssignmentsLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : assignments && assignments.length > 0 ? (
                    assignments.map(assignment => (
                        <Card key={assignment.id} className="border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-2xl group overflow-hidden">
                            <CardHeader className="flex flex-row items-center gap-4">
                                <div className="bg-primary/5 text-primary p-4 rounded-2xl transition-all group-hover:bg-primary group-hover:text-white"><FileText className="h-6 w-6" /></div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg font-black truncate uppercase tracking-tight">{assignment.title}</CardTitle>
                                    <CardDescription className="font-black text-[10px] text-muted-foreground uppercase tracking-widest">{assignment.courseCode}</CardDescription>
                                </div>
                                <div className="hidden md:flex flex-col items-end gap-1">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> Deadline</p>
                                    <p className="text-sm font-bold text-slate-700">{format(new Date(assignment.deadline), 'MMM d, yyyy')}</p>
                                </div>
                                <Button asChild variant="secondary" className="rounded-xl h-10 px-8 shrink-0"><Link href={`/academics/assignment/${assignment.id}?courseId=${assignment.courseId}`}>Access</Link></Button>
                            </CardHeader>
                        </Card>
                    ))
                ) : <div className="text-center py-20 opacity-20 font-black uppercase text-xs">No active assignments indexed</div>}
              </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="materials" className="mt-8">
            <Card className="glass-card border-none">
              <CardHeader className="flex flex-row items-center justify-between border-b border-indigo-50/50 pb-8">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight uppercase">CURRICULUM ASSETS</CardTitle>
                    <CardDescription className="text-xs font-medium">Host and access learning resources.</CardDescription>
                </div>
                {isFaculty && (
                    <Dialog open={openMaterialDialog} onOpenChange={setOpenMaterialDialog}>
                        <DialogTrigger asChild><Button onClick={() => materialForm.reset()} className="rounded-xl"><PlusCircle className="mr-2 h-4 w-4" /> Add Resource</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">New Intellectual Asset</DialogTitle></DialogHeader>
                            <Form {...materialForm}><form onSubmit={materialForm.handleSubmit(onAddMaterial)} className="space-y-4 pt-4">
                                <FormField control={materialForm.control} name="courseId" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Module</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{displayCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select></FormItem>
                                )} />
                                <FormField control={materialForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset Name</FormLabel><FormControl><Input {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <FormField control={materialForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Overview</FormLabel><FormControl><Textarea {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <FormField control={materialForm.control} name="fileUrl" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset Link</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} className="glass-input" /></FormControl></FormItem> )} />
                                <DialogFooter className="pt-6"><Button type="submit" className="rounded-xl px-10 h-12 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Authorize & Upload</Button></DialogFooter>
                            </form></Form>
                        </DialogContent>
                    </Dialog>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 mt-6">
                {areStudyMaterialsLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : studyMaterials && studyMaterials.length > 0 ? (
                    studyMaterials.map(material => (
                    <Card key={material.id} className="group flex items-center justify-between p-6 border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-2xl">
                        <div className="flex items-center gap-6">
                            <div className="bg-accent/10 text-accent p-4 rounded-2xl group-hover:scale-110 transition-transform"><Download className="h-6 w-6" /></div>
                            <div className="flex-1 space-y-1">
                                <h4 className="font-black text-slate-800 uppercase tracking-tight"> {material.title}</h4>
                                <p className="text-xs text-muted-foreground font-medium">{material.description} • <span className="text-accent font-black uppercase text-[10px] tracking-widest">{material.courseCode}</span></p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" asChild className="rounded-xl h-10 px-8 hover:bg-white"><a href={material.fileUrl} target="_blank" rel="noopener noreferrer">Download <Download className="ml-2 h-3 w-3" /></a></Button>
                    </Card>
                    ))
                ) : <div className="text-center py-20 opacity-20 font-black uppercase text-xs">No assets indexed</div>}
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}