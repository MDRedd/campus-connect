'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
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
import { Download, GraduationCap } from 'lucide-react';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import Link from 'next/link';
import type { Course } from '@/lib/data';

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

type GroupedResults = {
  [key: string]: (Result & { courseName: string; courseCode: string })[];
};


export default function ResultsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  // --- Common ---
  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'courses');
  }, [firestore, authUser]);
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

  // --- Faculty & Admin Specific ---
  const canManageResults = userProfile?.role === 'faculty' || userProfile?.role === 'course-admin' || userProfile?.role === 'super-admin';
  const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

  const isLoading = isUserLoading || areAllCoursesLoading;
  
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

  // FACULTY & ADMIN VIEW
  if (canManageResults) {
    const coursesForManager = userProfile?.role === 'faculty' ? facultyCourses : allCourses;
    const isManagerDataLoading = areAllCoursesLoading || (userProfile?.role === 'faculty' && areFacultyCoursesLoading);
    
    return (
        <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Manage Results</CardTitle>
              <CardDescription>Select a course to add, edit, or publish student results.</CardDescription>
            </CardHeader>
            <CardContent>
                {isManagerDataLoading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
                    </div>
                ) : coursesForManager && coursesForManager.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {coursesForManager.map(course => (
                            <Card key={course.id} className="flex flex-col">
                                <CardHeader className="flex-grow">
                                    <CardTitle className="text-lg">{course.name}</CardTitle>
                                    <CardDescription>{course.code}</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/results/${course.id}`}>Manage Results</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                        <GraduationCap className="h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">No Courses Found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">You are not assigned to any courses to manage results.</p>
                    </div>
                )}
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
