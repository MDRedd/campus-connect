'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
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
import { BookCopy, PlusCircle, Edit, Trash2, Search, FilterX } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

type Course = {
  id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
};

const courseSchema = z.object({
  name: z.string().min(3, 'Course name is required.'),
  code: z.string().min(3, 'Course code is required.'),
  department: z.string().min(3, 'Department is required.'),
  credits: z.coerce.number().min(1, 'Credits must be at least 1.'),
});


export default function CoursesPage() {
  const { user: authUser, profile: currentUserProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [openCourseDialog, setOpenCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(allCoursesQuery);

  const filteredCourses = useMemo(() => {
    if (!allCourses) return null;
    return allCourses.filter(course => 
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allCourses, searchQuery]);

  // Student-specific data
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || currentUserProfile?.role !== 'student') return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser, currentUserProfile]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<{courseId: string}>(enrollmentsQuery);

  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return new Set<string>();
    return new Set(enrollments.map(e => e.courseId));
  }, [enrollments]);

  const courseForm = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
  });

  const handleEditClick = (course: Course) => {
    setEditingCourse(course);
    courseForm.reset({
        name: course.name,
        code: course.code,
        department: course.department,
        credits: course.credits,
    });
    setOpenCourseDialog(true);
  };

  const handleAddNewClick = () => {
    setEditingCourse(null);
    courseForm.reset({
        name: '',
        code: '',
        department: '',
        credits: 1,
    });
    setOpenCourseDialog(true);
  }

  const handleDelete = (courseId: string) => {
    if (!firestore) return;
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;
    const courseRef = doc(firestore, 'courses', courseId);
    deleteDocumentNonBlocking(courseRef);
    toast({ title: 'Success', description: 'Course deleted.' });
  }

  function onCourseSubmit(values: z.infer<typeof courseSchema>) {
    if (!firestore) return;
    
    if (editingCourse) {
        const courseRef = doc(firestore, 'courses', editingCourse.id);
        updateDocumentNonBlocking(courseRef, values);
        toast({ title: 'Success', description: 'Course updated.' });
    } else {
        const courseRef = collection(firestore, 'courses');
        addDocumentNonBlocking(courseRef, values);
        toast({ title: 'Success', description: 'Course added.' });
    }
    setOpenCourseDialog(false);
    setEditingCourse(null);
    courseForm.reset();
  }

  const handleEnroll = (course: Course) => {
    if (!firestore || !authUser) return;
    setEnrollingCourseId(course.id);
    
    const enrollmentRef = collection(firestore, 'users', authUser.uid, 'enrollments');
    addDocumentNonBlocking(enrollmentRef, {
      studentId: authUser.uid,
      courseId: course.id,
      semester: 'Fall', // Using a default value for now
      year: new Date().getFullYear(),
    });

    toast({
      title: "Enrolled Successfully!",
      description: `You have been enrolled in ${course.name}.`,
    });
    
    setEnrollingCourseId(null);
  };

  const isLoading = isUserLoading || areCoursesLoading || (currentUserProfile?.role === 'student' && areEnrollmentsLoading);

  const canManageCourses = currentUserProfile?.role === 'super-admin' || currentUserProfile?.role === 'course-admin';

  if (isLoading) {
    return (
        <div>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-5 w-1/2 mt-2" />
            <Card className="mt-6">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-5 w-64" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  // ADMIN VIEW
  if (canManageCourses) {
    return (
        <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Course Management</h1>
                <p className="text-muted-foreground">
                Add, edit, and manage all courses offered.
                </p>
            </div>
            <Dialog open={openCourseDialog} onOpenChange={setOpenCourseDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick}><PlusCircle className="mr-2" /> Add Course</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle></DialogHeader>
                    <Form {...courseForm}>
                        <form onSubmit={courseForm.handleSubmit(onCourseSubmit)} className="space-y-4">
                            <FormField control={courseForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Course Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={courseForm.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Course Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={courseForm.control} name="department" render={({ field }) => ( <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={courseForm.control} name="credits" render={({ field }) => ( <FormItem><FormLabel>Credits</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">{editingCourse ? 'Save Changes' : 'Add Course'}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>All Courses</CardTitle>
                        <CardDescription>A list of all available courses.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search courses..." 
                                className="pl-8 w-[250px]" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {searchQuery && (
                            <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} title="Clear Search">
                                <FilterX className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {areCoursesLoading ? (
                    [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredCourses && filteredCourses.length > 0 ? (
                    filteredCourses.map(course => (
                    <TableRow key={course.id}>
                        <TableCell className="font-medium">
                            <Link href={`/courses/${course.id}`} className="hover:underline">
                                {course.name}
                            </Link>
                        </TableCell>
                        <TableCell>{course.code}</TableCell>
                        <TableCell>{course.department}</TableCell>
                        <TableCell>{course.credits}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(course)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(course.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No courses found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
        </div>
    );
  }

  // STUDENT VIEW
  if (currentUserProfile?.role === 'student') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Course Catalog</h1>
                <p className="text-muted-foreground">Browse and enroll in available courses.</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search for courses..." 
                        className="pl-8 w-full md:w-[300px]" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {searchQuery && (
                    <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} title="Clear Search">
                        <FilterX className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
        {filteredCourses && filteredCourses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => {
                    const isEnrolled = enrolledCourseIds.has(course.id);
                    const isEnrolling = enrollingCourseId === course.id;
                    return (
                        <Card key={course.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-start gap-4">
                                    <div className="bg-primary/10 text-primary p-3 rounded-lg"><BookCopy className="h-6 w-6" /></div>
                                    <span className="flex-1">{course.name}</span>
                                </CardTitle>
                                <CardDescription>{course.code} | {course.credits} Credits</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">Department: {course.department}</p>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" disabled={isEnrolled || isEnrolling} onClick={() => handleEnroll(course)}>
                                    {isEnrolling ? 'Enrolling...' : isEnrolled ? 'Enrolled' : 'Enroll'}
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        ) : (
            <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">No courses found matching your search.</p></CardContent></Card>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <Card>
        <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to view this page.</CardDescription>
        </CardHeader>
    </Card>
  )
}
