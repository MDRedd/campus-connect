'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode } from 'lucide-react';

type Course = {
  id: string;
  name: string;
  code: string;
};

export default function MarkAttendancePage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // In a real app, this would query only courses taught by the faculty
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: courses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

  const qrData = selectedCourseId && authUser ? JSON.stringify({
    courseId: selectedCourseId,
    facultyId: authUser.uid,
    timestamp: Date.now(),
  }) : null;

  const qrImageUrl = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}` : null;

  const isLoading = isAuthUserLoading || areCoursesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Generate a QR code for students to scan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Attendance QR Code</CardTitle>
          <CardDescription>Select a course to generate a unique QR code. Students can scan this code to mark their attendance for today's class.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course-select">Select Course</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select onValueChange={setSelectedCourseId} disabled={!courses}>
                  <SelectTrigger id="course-select">
                    <SelectValue placeholder="Select a course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name} ({course.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              The QR code is valid for 60 seconds. A new code will be generated implicitly if you re-select a course.
            </p>
          </div>
          <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/50 p-8">
            {qrImageUrl ? (
                <div className="text-center flex flex-col items-center gap-4">
                    <Image
                        src={qrImageUrl}
                        alt="Attendance QR Code"
                        width={250}
                        height={250}
                    />
                    <p className="text-sm font-medium">Scan this code to mark your attendance.</p>
                </div>
            ) : (
                <div className="text-center flex flex-col items-center gap-4 text-muted-foreground">
                    <QrCode className="h-16 w-16" />
                    <p>Select a course to display the QR code</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
