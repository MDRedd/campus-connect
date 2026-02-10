
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, getDocs, collectionGroup } from 'firebase/firestore';
import { BookOpen, Percent, FileWarning, Users, CheckCircle } from 'lucide-react';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';
import { Skeleton } from '@/components/ui/skeleton';
import type { Course } from '@/lib/data';
import { format } from 'date-fns';

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};

type Assignment = { id: string; courseId: string; deadline: string; };
type Submission = { id: string; courseId: string; assignmentId: string; marksAwarded?: number; };
type UserProfileData = { name: string; role: 'student' | 'faculty' | 'admin' };
type Enrollment = { courseId: string };
type AttendanceRecord = { courseId: string; status: 'present' | 'absent' };
type Announcement = { id: string; title: string; description: string; date: any; };

export default function DashboardPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
  const [areStatsLoading, setAreStatsLoading] = useState(true);

  // --- Common Data ---
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfileData>(userDocRef);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile) return null;

    let q = query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));

    if (userProfile.role !== 'admin') {
        const targetAudiences = ['all', userProfile.role];
        q = query(
            collection(firestore, 'announcements'),
            where('targetAudience', 'in', targetAudiences),
            orderBy('date', 'desc'),
            limit(3)
        );
    }
    
    return q;
  }, [firestore, userProfile]);
  const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);

  // --- Student-specific data hooks ---
  const studentEnrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return collection(firestore, 'users', authUser.uid, 'enrollments');
  }, [firestore, authUser, userProfile]);
  const { data: studentEnrollments, isLoading: areStudentEnrollmentsLoading } = useCollection<Enrollment>(studentEnrollmentsQuery);

  const studentAttendanceQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return collection(firestore, 'users', authUser.uid, 'attendance');
  }, [firestore, authUser, userProfile]);
  const { data: studentAttendance, isLoading: isStudentAttendanceLoading } = useCollection<AttendanceRecord>(studentAttendanceQuery);


  // --- All courses data (used by all roles in some way) ---
  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

  // --- Role-based stats calculation ---
  useEffect(() => {
    if (isUserProfileLoading || !userProfile || !firestore || !allCourses || !authUser) {
      return;
    }
    
    setAreStatsLoading(true);

    const calculateStats = async () => {
      let stats: QuickStat[] = [];
      if (userProfile.role === 'student') {
        if (areStudentEnrollmentsLoading || isStudentAttendanceLoading) return;

        const enrolledCourseIds = new Set(studentEnrollments?.map(e => e.courseId) ?? []);
        const enrolledCourses = allCourses.filter(c => enrolledCourseIds.has(c.id));
        
        // --- Overall Attendance Stat ---
        const attendanceStats: { [key: string]: { attended: number, total: number } } = {};
        studentAttendance?.forEach(rec => {
          if (enrolledCourseIds.has(rec.courseId)) {
            if (!attendanceStats[rec.courseId]) attendanceStats[rec.courseId] = { attended: 0, total: 0 };
            attendanceStats[rec.courseId].total++;
            if (rec.status === 'present') attendanceStats[rec.courseId].attended++;
          }
        });
        const percentages = Object.values(attendanceStats).map(s => s.total > 0 ? (s.attended / s.total) * 100 : 0);
        const overallAttendance = percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
        
        // --- Assignments Due Stat ---
        let dueAssignmentsCount = 0;
        if (enrolledCourses.length > 0) {
          const courseIds = enrolledCourses.map(c => c.id);
          // Fetch all assignments and submissions in parallel for the student's courses
          const assignmentsQuery = query(collectionGroup(firestore, 'assignments'), where('courseId', 'in', courseIds));
          const submissionsQuery = query(collectionGroup(firestore, 'submissions'), where('studentId', '==', authUser.uid), where('courseId', 'in', courseIds));
          const [assignmentsSnapshot, submissionsSnapshot] = await Promise.all([getDocs(assignmentsQuery), getDocs(submissionsQuery)]);

          const submittedAssignmentIds = new Set(submissionsSnapshot.docs.map(doc => doc.data().assignmentId));
          const now = new Date();

          dueAssignmentsCount = assignmentsSnapshot.docs.filter(doc => {
            const assignment = doc.data() as Assignment;
            return new Date(assignment.deadline) > now && !submittedAssignmentIds.has(doc.id);
          }).length;
        }

        stats = [
          { title: 'Enrolled Courses', value: (studentEnrollments?.length ?? 0).toString(), icon: BookOpen },
          { title: 'Overall Attendance', value: `${overallAttendance}%`, icon: Percent },
          { title: 'Assignments Due', value: dueAssignmentsCount.toString(), icon: FileWarning },
        ];

      } else if (userProfile.role === 'faculty') {
        const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', authUser.uid));
        const timetableSnapshot = await getDocs(timetablesQuery);
        const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

        let studentCount = 0;
        let submissionsToGrade = 0;

        if (facultyCourseIds.length > 0) {
            const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', 'in', facultyCourseIds));
            const submissionsQuery = query(collectionGroup(firestore, 'submissions'), where('courseId', 'in', facultyCourseIds));
            
            const [enrollmentsSnapshot, submissionsSnapshot] = await Promise.all([getDocs(enrollmentsQuery), getDocs(submissionsQuery)]);
            
            studentCount = new Set(enrollmentsSnapshot.docs.map(d => d.data().studentId)).size;
            submissionsToGrade = submissionsSnapshot.docs.filter(d => d.data().marksAwarded === undefined || d.data().marksAwarded === null).length;
        }

        stats = [
          { title: 'Active Courses', value: facultyCourseIds.length.toString(), icon: BookOpen },
          { title: 'Total Students', value: studentCount.toString(), icon: Users },
          { title: 'Submissions to Grade', value: submissionsToGrade.toString(), icon: CheckCircle },
        ];
      } else if (userProfile.role === 'admin') {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const studentCount = usersSnapshot.docs.filter(d => d.data().role === 'student').length;
        const facultyCount = usersSnapshot.docs.filter(d => d.data().role === 'faculty').length;
        
        stats = [
          { title: 'Total Students', value: studentCount.toString(), icon: Users },
          { title: 'Total Faculty', value: facultyCount.toString(), icon: Users },
          { title: 'Total Courses', value: (allCourses?.length ?? 0).toString(), icon: BookOpen },
        ];
      }
      setQuickStats(stats);
      setAreStatsLoading(false);
    };

    calculateStats();
  }, [userProfile, isUserProfileLoading, firestore, allCourses, areAllCoursesLoading, studentEnrollments, areStudentEnrollmentsLoading, studentAttendance, isStudentAttendanceLoading, authUser]);


  // --- Data for other components ---
  const [todaysClasses, setTodaysClasses] = useState<any[] | null>(null);
  const [areTodaysClassesLoading, setAreTodaysClassesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !userProfile || !authUser || !allCourses) return;

    const fetchTodaysClasses = async () => {
        setAreTodaysClassesLoading(true);
        const today = new Date().toLocaleString('en-US', { weekday: 'long' });
        let timetableQuery;

        if (userProfile.role === 'student') {
            if (areStudentEnrollmentsLoading || !studentEnrollments) return;
            const enrolledCourseIds = studentEnrollments.map(e => e.courseId);
            if (enrolledCourseIds.length === 0) {
              setTodaysClasses([]);
              setAreTodaysClassesLoading(false);
              return;
            }
            timetableQuery = query(collectionGroup(firestore, 'timetables'), where('courseId', 'in', enrolledCourseIds), where('dayOfWeek', '==', today));
        } else if (userProfile.role === 'faculty') {
            timetableQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', authUser.uid), where('dayOfWeek', '==', today));
        } else { // Admin
             setTodaysClasses([]);
             setAreTodaysClassesLoading(false);
             return;
        }
        
        try {
            const querySnapshot = await getDocs(timetableQuery);
            const courseMap = new Map(allCourses.map(c => [c.id, c]));
            const allClasses = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const course = courseMap.get(data.courseId);
                return { id: doc.id, ...data, course: { name: course?.name, code: course?.code } };
            }).sort((a, b) => a.startTime.localeCompare(b.startTime));
            setTodaysClasses(allClasses);
        } catch (error) {
            console.error("Error fetching timetable:", error);
            setTodaysClasses([]);
        } finally {
            setAreTodaysClassesLoading(false);
        }
    };
    fetchTodaysClasses();
  }, [firestore, userProfile, authUser, allCourses, studentEnrollments, areStudentEnrollmentsLoading]);

  const attendanceData = useMemo(() => {
    if (userProfile?.role !== 'student' || isStudentAttendanceLoading || areAllCoursesLoading || !studentAttendance || !allCourses) return null;
    
    const enrolledCourseIds = new Set(studentEnrollments?.map(e => e.courseId) ?? []);
    const stats: { [key: string]: { attended: number, total: number } } = {};

    studentAttendance.forEach(rec => {
        if (enrolledCourseIds.has(rec.courseId)) {
            if (!stats[rec.courseId]) stats[rec.courseId] = { attended: 0, total: 0 };
            stats[rec.courseId].total++;
            if (rec.status === 'present') stats[rec.courseId].attended++;
        }
    });
    
    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    return Object.entries(stats).map(([courseId, { attended, total }]) => ({
      name: courseMap.get(courseId)?.code || 'N/A',
      attended,
      total,
      percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
    }));
  }, [studentAttendance, allCourses, studentEnrollments, isStudentAttendanceLoading, areAllCoursesLoading, userProfile]);

  const displayAnnouncements = announcements?.map(a => ({...a, content: a.description, date: a.date ? format(a.date.toDate(), 'MMM d, yyyy') : '...'}));

  const isPageLoading = isAuthUserLoading || isUserProfileLoading;

  if (isPageLoading) {
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

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner user={userProfile} />
      <QuickStats stats={quickStats} isLoading={areStatsLoading} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {areTodaysClassesLoading ? (
            <Skeleton className="h-80" />
          ) : (
            todaysClasses && <UpcomingClasses timetable={todaysClasses} />
          )}
        </div>
        {userProfile.role === 'student' && (
            isStudentAttendanceLoading || areAllCoursesLoading ? (
                <Skeleton className="h-80" />
            ) : (
                attendanceData && <AttendanceChart data={attendanceData} />
            )
        )}
      </div>
      {areAnnouncementsLoading ? (
         <Skeleton className="h-64" />
      ) : (
        displayAnnouncements && <RecentAnnouncements announcements={displayAnnouncements} />
      )}
    </div>
  );
}
