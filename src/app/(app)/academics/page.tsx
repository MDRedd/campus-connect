'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BookCopy, FileText, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Simplified types based on backend.json
type Enrollment = {
  courseId: string;
  // ... other fields
};

type Course = {
  id: string;
  name: string;
  code: string;
  credits: number;
};

export default function AcademicsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !allCourses) return null;
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
    return allCourses.filter(course => enrolledCourseIds.has(course.id));
  }, [enrollments, allCourses]);

  const isLoading = isAuthUserLoading || areEnrollmentsLoading || areCoursesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academics</h1>
        <p className="text-muted-foreground">
          Manage your courses, assignments, and study materials.
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
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : enrolledCourses && enrolledCourses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((course) => (
                <Card key={course.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-lg">
                        <BookCopy className="h-6 w-6" />
                      </div>
                      <span className="flex-1">{course.name}</span>
                    </CardTitle>
                    <CardDescription>
                      {course.code} | {course.credits} Credits
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      Faculty: TBD
                    </p>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button size="sm">View Details</Button>
                    <Button size="sm" variant="outline">
                      Go to Course
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
             <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">You are not enrolled in any courses.</p>
                </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Assignments</CardTitle>
              <CardDescription>
                Submit your work before the deadline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Assignments... Yet!</h3>
                <p className="mt-1 text-sm text-muted-foreground">Check back here for updates on your coursework.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Study Materials</CardTitle>
              <CardDescription>
                Download lecture notes and other resources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <Download className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Materials Available</h3>
                <p className="mt-1 text-sm text-muted-foreground">Your instructors will upload materials here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}