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

type Result = {
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

type GroupedResults = {
  [key: string]: (Result & { courseName: string; courseCode: string })[];
};

export default function ResultsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const resultsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    // Only fetch published results, as per security rules
    return query(collection(firestore, 'users', authUser.uid, 'results'), where('published', '==', true));
  }, [firestore, authUser]);
  const { data: results, isLoading: areResultsLoading } = useCollection<Result>(resultsQuery);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

  const groupedResults = useMemo<GroupedResults | null>(() => {
    if (!results || !allCourses) return null;

    const courseMap = new Map(allCourses.map(c => [c.id, c]));

    return results.reduce((acc, result) => {
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
  }, [results, allCourses]);

  const sortedSemesterKeys = useMemo(() => {
    if (!groupedResults) return null;
    return Object.keys(groupedResults).sort((a, b) => {
      const [semA, yearA] = a.split(' ');
      const [semB, yearB] = b.split(' ');
      if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
      // Assuming some semester order if needed, but alphabetical might be fine
      return semB.localeCompare(semA);
    });
  }, [groupedResults]);

  const isLoading = isAuthUserLoading || areResultsLoading || areCoursesLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Semester Results</CardTitle>
        <CardDescription>
          View your semester results and download report cards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
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
