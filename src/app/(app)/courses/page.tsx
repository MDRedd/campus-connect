'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
import { BookCopy, PlusCircle, Edit, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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

type UserProfile = {
  role: 'student' | 'faculty' | 'admin';
};

const courseSchema = z.object({
  name: z.string().min(3, 'Course name is required.'),
  code: z.string().min(3, 'Course code is required.'),
  department: z.string().min(3, 'Department is required.'),
  credits: z.coerce.number().min(1, 'Credits must be at least 1.'),
});


export default function CoursesPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [openCourseDialog, setOpenCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: currentUserProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || isUserProfileLoading || !currentUserProfile || (currentUserProfile.role !== 'admin' && currentUserProfile.role !== 'faculty')) return null;
    return collection(firestore, 'courses');
  }, [firestore, isUserProfileLoading, currentUserProfile]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(allCoursesQuery);

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

  const handleDelete = async (courseId: string) => {
    if (!firestore) return;
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;
    try {
        const courseRef = doc(firestore, 'courses', courseId);
        await deleteDoc(courseRef);
        toast({ title: 'Success', description: 'Course deleted.' });
    } catch (error) {
        console.error("Error deleting course:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete course.' });
    }
  }

  async function onCourseSubmit(values: z.infer<typeof courseSchema>) {
    if (!firestore) return;
    try {
        if (editingCourse) {
            const courseRef = doc(firestore, 'courses', editingCourse.id);
            await updateDoc(courseRef, values);
            toast({ title: 'Success', description: 'Course updated.' });
        } else {
            const courseRef = collection(firestore, 'courses');
            await addDoc(courseRef, values);
            toast({ title: 'Success', description: 'Course added.' });
        }
        setOpenCourseDialog(false);
        setEditingCourse(null);
        courseForm.reset();
    } catch (error) {
        console.error("Error saving course:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save course.' });
    }
  }

  const isLoading = isAuthUserLoading || isUserProfileLoading || areCoursesLoading;

  if (currentUserProfile && currentUserProfile.role === 'student') {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have permission to view this page.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Course Management</h1>
        <p className="text-muted-foreground">
          Add, edit, and manage all courses offered.
        </p>
      </div>
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>All Courses</CardTitle>
            <CardDescription>A list of all available courses.</CardDescription>
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
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : allCourses && allCourses.length > 0 ? (
                allCourses.map(course => (
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
