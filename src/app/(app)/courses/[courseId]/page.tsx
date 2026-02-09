'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookCopy, Building, Star } from 'lucide-react';

type Course = {
  id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
};

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const courseId = params.courseId as string;

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        {isCourseLoading ? (
            <Skeleton className="h-9 w-64 mb-2" />
        ) : course ? (
            <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
        ) : (
            <h1 className="text-3xl font-bold tracking-tight">Course Not Found</h1>
        )}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {isCourseLoading ? (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
            </CardContent>
        </Card>
      ) : course ? (
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>
              Detailed information about {course.code}.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-start gap-4 rounded-lg border p-4">
                    <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                        <BookCopy className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Course Code</p>
                        <p className="font-semibold text-lg">{course.code}</p>
                    </div>
                </div>
                 <div className="flex items-start gap-4 rounded-lg border p-4">
                    <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                        <Building className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Department</p>
                        <p className="font-semibold text-lg">{course.department}</p>
                    </div>
                </div>
                 <div className="flex items-start gap-4 rounded-lg border p-4">
                    <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                        <Star className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Credits</p>
                        <p className="font-semibold text-lg">{course.credits}</p>
                    </div>
                </div>
            </div>
            {/* Placeholder for future tabs */}
             <div className="mt-8 text-center text-muted-foreground">
                <p>More details like assignments, materials, and enrolled students will be shown here.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
         <Card>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">The course you are looking for does not exist or you do not have permission to view it.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
