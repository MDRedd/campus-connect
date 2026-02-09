'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode } from 'lucide-react';
import type { Course } from '@/lib/data';

type AttendanceRecord = {
  courseId: string;
  status: 'present' | 'absent';
};

type UserProfile = {
  role: 'student' | 'faculty' | 'admin';
};

type Enrollment = {
  courseId: string;
};


export default function AttendancePage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'courses');
  }, [firestore, authUser]);
  const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !allCourses) return null;
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
    return allCourses.filter(course => enrolledCourseIds.has(course.id));
  }, [enrollments, allCourses]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'attendance');
  }, [firestore, authUser]);
  const { data: attendanceRecords, isLoading: isAttendanceLoading } =
    useCollection<AttendanceRecord>(attendanceQuery);

  const attendanceData = useMemo(() => {
    if (isAttendanceLoading || areCoursesLoading || areEnrollmentsLoading || !attendanceRecords || !enrolledCourses) {
      return null;
    }

    const stats: { [courseId: string]: { attended: number; total: number } } = {};

    for (const record of attendanceRecords) {
      if (!stats[record.courseId]) {
        stats[record.courseId] = { attended: 0, total: 0 };
      }
      stats[record.courseId].total++;
      if (record.status === 'present') {
        stats[record.courseId].attended++;
      }
    }

    return enrolledCourses
        .map(course => {
            const courseStats = stats[course.id];
            if (!courseStats) {
                // If a course has no attendance records yet, show it with 0%
                return {
                    ...course,
                    attended: 0,
                    total: 0,
                    percentage: 0,
                }
            }

            const { attended, total } = courseStats;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
            
            return {
                ...course,
                attended,
                total,
                percentage,
            };
        })
        .sort((a,b) => a.name.localeCompare(b.name));
        
  }, [attendanceRecords, enrolledCourses, isAttendanceLoading, areCoursesLoading, areEnrollmentsLoading]);

  const isLoading = isAuthUserLoading || areCoursesLoading || isAttendanceLoading || isUserProfileLoading || areEnrollmentsLoading;

  return (
    <div className="flex flex-col gap-6">
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">View your attendance records and get alerts for low attendance.</p>
        </div>
        {userProfile?.role === 'student' && (
          <Button asChild>
            <Link href="/attendance/scan">
              <QrCode className="mr-2 h-4 w-4" />
              Scan QR Code
            </Link>
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-1/4" />
                    </CardContent>
                </Card>
            ))}
        </div>
      ) : attendanceData && attendanceData.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {attendanceData.map((data) => (
            <Card key={data.id}>
              <CardHeader>
                <CardTitle>{data.name}</CardTitle>
                <CardDescription>{data.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium">
                      Attendance: {data.attended} / {data.total} classes
                    </p>
                    <p className="text-sm font-bold">{data.percentage}%</p>
                  </div>
                  <Progress value={data.percentage} className="h-2" />
                </div>
                {data.percentage < 75 && data.total > 0 && (
                    <p className="text-sm text-destructive">
                        Your attendance is low. Please attend classes regularly.
                    </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">You are not enrolled in any courses or no attendance data is available.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
