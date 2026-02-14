'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, ClipboardList, QrCode } from 'lucide-react';
import type { Course } from '@/lib/data';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';

type AttendanceRecord = {
  courseId: string;
  status: 'present' | 'absent';
};

type Enrollment = {
  courseId: string;
};


export default function AttendancePage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);
  
  // --- Student-specific data ---
  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser, userProfile]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !allCourses) return null;
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
    return allCourses.filter(course => enrolledCourseIds.has(course.id));
  }, [enrollments, allCourses]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return collection(firestore, 'users', authUser.uid, 'attendance');
  }, [firestore, authUser, userProfile]);
  const { data: attendanceRecords, isLoading: isAttendanceLoading } =
    useCollection<AttendanceRecord>(attendanceQuery);

  const attendanceData = useMemo(() => {
    if (userProfile?.role !== 'student' || isAttendanceLoading || areAllCoursesLoading || areEnrollmentsLoading || !attendanceRecords || !enrolledCourses) {
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
                return { ...course, attended: 0, total: 0, percentage: 0 };
            }
            const { attended, total } = courseStats;
            const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
            return { ...course, attended, total, percentage };
        })
        .sort((a,b) => a.name.localeCompare(b.name));
        
  }, [attendanceRecords, enrolledCourses, isAttendanceLoading, areAllCoursesLoading, areEnrollmentsLoading, userProfile]);

  // --- Faculty & Admin specific data ---
  const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();
  const canManageAttendance = userProfile?.role === 'faculty' || userProfile?.role === 'attendance-admin' || userProfile?.role === 'super-admin';
  const coursesForManager = userProfile?.role === 'faculty' ? facultyCourses : allCourses;
  const areManagerCoursesLoading = userProfile?.role === 'faculty' ? areFacultyCoursesLoading : areAllCoursesLoading;


  const isLoading = isUserLoading || areAllCoursesLoading || (userProfile?.role === 'student' && (areEnrollmentsLoading || isAttendanceLoading)) || (canManageAttendance && areManagerCoursesLoading);

  if (isLoading) {
      return (
          <div className="flex flex-col gap-6">
              <Skeleton className="h-10 w-1/2" />
              <div className="grid gap-6 md:grid-cols-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
          </div>
      );
  }

  if (canManageAttendance) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
            <p className="text-muted-foreground">View attendance records for your courses.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/attendance/requests">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Review Requests
              </Link>
            </Button>
            <Button asChild>
              <Link href="/attendance/mark">
                <QrCode className="mr-2 h-4 w-4" />
                Start Session
              </Link>
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>Select a course to view detailed attendance records for enrolled students.</CardDescription>
          </CardHeader>
          <CardContent>
            {coursesForManager && coursesForManager.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {coursesForManager.map(course => (
                  <Card key={course.id} className="flex flex-col">
                    <CardHeader className="flex-grow">
                      <CardTitle className="text-lg">{course.name}</CardTitle>
                      <CardDescription>{course.code}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button asChild className="w-full">
                        <Link href={`/attendance/view/${course.id}`}>View Attendance Records</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <ClipboardList className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Courses Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">You are not currently assigned to any courses to manage.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student View (Default)
  return (
    <div className="flex flex-col gap-6">
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">View your attendance records and get alerts for low attendance.</p>
        </div>
        <Button asChild>
          <Link href="/attendance/scan">
            <QrCode className="mr-2 h-4 w-4" />
            Scan QR Code
          </Link>
        </Button>
      </div>
      
      {attendanceData && attendanceData.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {attendanceData.map((data) => (
            <Link key={data.id} href={`/attendance/history/${data.id}`} className="block rounded-lg transition-all hover:ring-2 hover:ring-primary/50">
              <Card className="h-full">
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
            </Link>
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
