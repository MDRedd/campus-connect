'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, getDocs } from 'firebase/firestore';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';
import { Skeleton } from '@/components/ui/skeleton';
import type { Course } from '@/lib/data';

export default function DashboardPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<{ name: string; role: 'student' | 'faculty' | 'admin' }>(userDocRef);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));
  }, [firestore]);
  const { data: announcements, isLoading: isAnnouncementsLoading } = useCollection<{id: string; title: string; description: string; date: string;}>(announcementsQuery);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: courses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<{courseId: string}>(enrollmentsQuery);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !courses) return null;
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
    return courses.filter(course => enrolledCourseIds.has(course.id));
  }, [enrollments, courses]);

  const [todaysClasses, setTodaysClasses] = useState<any[] | null>(null);
  const [areTodaysClassesLoading, setAreTodaysClassesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !enrolledCourses) return;
    if (enrolledCourses.length === 0) {
      setTodaysClasses([]);
      setAreTodaysClassesLoading(false);
      return;
    }

    const fetchTodaysClasses = async () => {
      setAreTodaysClassesLoading(true);
      const today = new Date().toLocaleString('en-US', { weekday: 'long' });
      const allClasses: any[] = [];

      try {
        for (const course of enrolledCourses) {
            const timetablesQuery = query(
            collection(firestore, 'courses', course.id, 'timetables'),
            where('dayOfWeek', '==', today)
            );
            const querySnapshot = await getDocs(timetablesQuery);
            querySnapshot.forEach((doc) => {
            allClasses.push({
                id: doc.id,
                ...doc.data(),
                course: { name: course.name, code: course.code }
            });
            });
        }
        allClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setTodaysClasses(allClasses);
      } catch (error) {
        console.error("Error fetching timetable:", error);
        setTodaysClasses([]);
      }
      setAreTodaysClassesLoading(false);
    };

    fetchTodaysClasses();
  }, [firestore, enrolledCourses]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'attendance');
  }, [firestore, authUser]);
  const { data: attendanceRecords, isLoading: isAttendanceLoading } = useCollection<{courseId: string, status: 'present' | 'absent'}>(attendanceQuery);


  const attendanceData = useMemo(() => {
    if (isAttendanceLoading || areCoursesLoading || !attendanceRecords || !courses) return null;

    const stats: { [courseId: string]: { attended: number, total: number } } = {};

    for (const record of attendanceRecords) {
      if (!stats[record.courseId]) {
        stats[record.courseId] = { attended: 0, total: 0 };
      }
      stats[record.courseId].total++;
      if (record.status === 'present') {
        stats[record.courseId].attended++;
      }
    }

    return Object.keys(stats).map(courseId => {
      const course = courses.find(c => c.id === courseId);
      const { attended, total } = stats[courseId];
      return {
        name: course?.code || 'N/A',
        attended: attended,
        total: total,
        percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
      };
    });
  }, [attendanceRecords, courses, isAttendanceLoading, areCoursesLoading]);


  if (isAuthUserLoading || isUserProfileLoading) {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-12 w-1/2" />
            <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Skeleton className="h-80" />
                </div>
                <Skeleton className="h-80" />
            </div>
            <Skeleton className="h-64" />
        </div>
    )
  }

  if (!userProfile) {
    return <div>Could not load user profile. Please try logging in again.</div>
  }
  
  const displayAnnouncements = announcements?.map(a => ({...a, content: a.description}));

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner user={userProfile} />
      <QuickStats userRole={userProfile.role} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {(areTodaysClassesLoading || areEnrollmentsLoading || areCoursesLoading) ? (
            <Skeleton className="h-80" />
          ) : (
            todaysClasses && <UpcomingClasses timetable={todaysClasses} />
          )}
        </div>
        {attendanceData ? (
          <AttendanceChart data={attendanceData} />
        ) : (
          <Skeleton className="h-80" />
        )}
      </div>
      {displayAnnouncements ? (
        <RecentAnnouncements announcements={displayAnnouncements} />
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
