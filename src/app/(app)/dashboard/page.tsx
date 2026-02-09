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

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};

type Assignment = { id: string; courseId: string; deadline: string; };
type Submission = { id: string; courseId: string; marksAwarded?: number; };


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
    if (!firestore || isAuthUserLoading || !authUser) return null;
    return collection(firestore, 'courses');
  }, [firestore, isAuthUserLoading, authUser]);
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
    if (isAttendanceLoading || areCoursesLoading || areEnrollmentsLoading || !attendanceRecords || !enrolledCourses) return null;

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
    
    // We only want to show courses with attendance records in the chart.
    const coursesWithAttendance = enrolledCourses.filter(c => stats[c.id]);

    return coursesWithAttendance.map(course => {
      const { attended, total } = stats[course.id];
      return {
        name: course?.code || 'N/A',
        attended: attended,
        total: total,
        percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
      };
    });
  }, [attendanceRecords, enrolledCourses, isAttendanceLoading, areCoursesLoading, areEnrollmentsLoading]);

  // Query for all users if admin
    const allUsersQuery = useMemoFirebase(() => {
        if (!firestore || !userProfile || userProfile.role !== 'admin') return null;
        return collection(firestore, 'users');
    }, [firestore, userProfile]);
    const { data: allUsers, isLoading: areAllUsersLoading } = useCollection<{role: string}>(allUsersQuery);

    // --- Data for Quick Stats ---
    const [assignments, setAssignments] = useState<Assignment[] | null>(null);
    const [mySubmissions, setMySubmissions] = useState<{[assignmentId: string]: Submission} | null>(null);
    const [areAssignmentsLoading, setAreAssignmentsLoading] = useState(true);
    const [areMySubmissionsLoading, setAreMySubmissionsLoading] = useState(true);
    const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
    const [areFacultyCoursesLoading, setAreFacultyCoursesLoading] = useState(true);
    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    
    const [facultyStudentCount, setFacultyStudentCount] = useState<number | null>(null);
    const [submissionsToGradeCount, setSubmissionsToGradeCount] = useState<number | null>(null);
    const [isFacultyStatsLoading, setIsFacultyStatsLoading] = useState(true);

    // Effect to fetch faculty-specific stats (student count, submissions to grade)
    useEffect(() => {
        if (userProfile?.role !== 'faculty' || !firestore || !facultyCourses) {
            setIsFacultyStatsLoading(false);
            return;
        };
        if (facultyCourses.length === 0) {
            setFacultyStudentCount(0);
            setSubmissionsToGradeCount(0);
            setIsFacultyStatsLoading(false);
            return;
        }

        const fetchStats = async () => {
            setIsFacultyStatsLoading(true);
            const facultyCourseIds = facultyCourses.map(c => c.id);

            // Fetch unique student count
            try {
                const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', 'in', facultyCourseIds));
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const studentIds = new Set(enrollmentsSnapshot.docs.map(d => d.data().studentId));
                setFacultyStudentCount(studentIds.size);
            } catch (e) {
                console.error("Error fetching student count for faculty:", e);
                setFacultyStudentCount(0); // fallback
            }

            // Fetch submissions to grade
            try {
                const submissionsQuery = query(collectionGroup(firestore, 'submissions'), where('courseId', 'in', facultyCourseIds));
                const submissionsSnapshot = await getDocs(submissionsQuery);
                const toGrade = submissionsSnapshot.docs.filter(d => d.data().marksAwarded === undefined || d.data().marksAwarded === null);
                setSubmissionsToGradeCount(toGrade.length);
            } catch (e) {
                console.error("Error fetching submissions to grade:", e);
                setSubmissionsToGradeCount(0); // fallback
            }

            setIsFacultyStatsLoading(false);
        };

        fetchStats();
    }, [firestore, userProfile, facultyCourses]);

    // Effect to fetch assignments for students
    useEffect(() => {
        if (!firestore || !enrolledCourses || userProfile?.role !== 'student') {
            setAssignments([]);
            setAreAssignmentsLoading(false);
            return;
        };
        if (enrolledCourses.length === 0) {
            setAssignments([]);
            setAreAssignmentsLoading(false);
            return;
        }

        const fetchData = async () => {
        setAreAssignmentsLoading(true);
        try {
            const allAssignments: Assignment[] = [];
            for (const course of enrolledCourses) {
            const assignmentsQuery = query(collection(firestore, 'courses', course.id, 'assignments'));
            const assignmentsSnapshot = await getDocs(assignmentsQuery);
            assignmentsSnapshot.forEach((doc) => {
                allAssignments.push({ ...(doc.data() as Omit<Assignment, 'id'>), id: doc.id });
            });
            }
            setAssignments(allAssignments);
        } catch (error) {
            console.error("Error fetching assignments for dashboard:", error);
            setAssignments([]);
        } finally {
            setAreAssignmentsLoading(false);
        }
        };

        fetchData();
    }, [firestore, enrolledCourses, userProfile]);

    // Effect to fetch submissions for students
    useEffect(() => {
        if (!firestore || !authUser || !assignments || userProfile?.role !== 'student') {
            setMySubmissions({});
            setAreMySubmissionsLoading(false);
            return;
        }
        if (assignments.length === 0) {
            setMySubmissions({});
            setAreMySubmissionsLoading(false);
            return;
        }

        const fetchMySubmissions = async () => {
            setAreMySubmissionsLoading(true);
            const subsMap: {[assignmentId: string]: Submission} = {};
            try {
                for (const assignment of assignments) {
                    const submissionsQuery = query(
                        collection(firestore, 'courses', assignment.courseId, 'assignments', assignment.id, 'submissions'),
                        where('studentId', '==', authUser.uid),
                        limit(1)
                    );
                    const querySnapshot = await getDocs(submissionsQuery);
                    if (!querySnapshot.empty) {
                        const doc = querySnapshot.docs[0];
                        subsMap[assignment.id] = { id: doc.id, ...(doc.data() as any) };
                    }
                }
                setMySubmissions(subsMap);
            } catch (error) {
                console.error("Error fetching submissions for dashboard:", error);
                setMySubmissions({});
            } finally {
                setAreMySubmissionsLoading(false);
            }
        };

        fetchMySubmissions();
    }, [firestore, authUser, assignments, userProfile]);

    // Effect to fetch courses for faculty
    useEffect(() => {
        if (!userProfile || userProfile.role !== 'faculty' || !firestore || !authUser || areCoursesLoading || !courses) {
            if (userProfile && userProfile.role === 'faculty') {
                setAreFacultyCoursesLoading(false);
                setFacultyCourses([]);
            }
            return;
        };
        
        const fetchFacultyCourses = async () => {
        setAreFacultyCoursesLoading(true);
        try {
            const timetablesQuery = query(
                collectionGroup(firestore, 'timetables'),
                where('facultyId', '==', authUser.uid)
            );
            const timetableSnapshot = await getDocs(timetablesQuery);
            const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];
            if (facultyCourseIds.length > 0) {
                setFacultyCourses(courses.filter(course => facultyCourseIds.includes(course.id)));
            } else {
                setFacultyCourses([]);
            }
        } catch (error) {
            console.error("Error fetching faculty courses:", error);
            setFacultyCourses([]);
        } finally {
            setAreFacultyCoursesLoading(false);
        }
        };
        fetchFacultyCourses();
    }, [firestore, authUser, courses, areCoursesLoading, userProfile]);

    useEffect(() => {
        if (isUserProfileLoading) return;
        if (!userProfile) return;

        const getStats = async () => {
            let stats: QuickStat[] = [];
            if (userProfile.role === 'student') {
                if (areEnrollmentsLoading || isAttendanceLoading || areAssignmentsLoading || areMySubmissionsLoading) return;
                const overallAttendance = attendanceData ? Math.round(attendanceData.reduce((acc, curr) => acc + curr.percentage, 0) / (attendanceData.length || 1)) : 0;
                
                const dueAssignments = assignments?.filter(assignment => {
                    const deadline = new Date(assignment.deadline);
                    const isDue = deadline > new Date();
                    const isSubmitted = mySubmissions ? !!mySubmissions[assignment.id] : false;
                    return isDue && !isSubmitted;
                }).length ?? 0;

                stats = [
                    { title: 'Enrolled Courses', value: (enrollments?.length ?? 0).toString(), icon: BookOpen },
                    { title: 'Overall Attendance', value: `${overallAttendance}%`, icon: Percent },
                    { title: 'Assignments Due', value: dueAssignments.toString(), icon: FileWarning },
                ];
            } else if (userProfile.role === 'faculty') {
                if (areFacultyCoursesLoading || isFacultyStatsLoading) return;
                stats = [
                    { title: 'Active Courses', value: (facultyCourses?.length ?? 0).toString(), icon: BookOpen },
                    { title: 'Total Students', value: (facultyStudentCount ?? 0).toString(), icon: Users },
                    { title: 'Submissions to Grade', value: (submissionsToGradeCount ?? 0).toString(), icon: CheckCircle },
                ];
            } else if (userProfile.role === 'admin') {
                if (areAllUsersLoading || areCoursesLoading) return;
                const studentCount = allUsers?.filter(u => u.role === 'student').length ?? 0;
                const facultyCount = allUsers?.filter(u => u.role === 'faculty').length ?? 0;
                stats = [
                    { title: 'Total Students', value: studentCount.toString(), icon: Users },
                    { title: 'Total Faculty', value: facultyCount.toString(), icon: Users },
                    { title: 'Total Courses', value: (courses?.length ?? 0).toString(), icon: BookOpen },
                ];
            }
            setQuickStats(stats);
        }

        getStats();
    }, [
        userProfile, isUserProfileLoading, areEnrollmentsLoading, isAttendanceLoading, enrollments, attendanceData, 
        allUsers, areAllUsersLoading, courses, areCoursesLoading,
        areAssignmentsLoading, areMySubmissionsLoading, assignments, mySubmissions,
        areFacultyCoursesLoading, facultyCourses,
        isFacultyStatsLoading, facultyStudentCount, submissionsToGradeCount
    ]);


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
  
  const displayAnnouncements = announcements?.map(a => ({...a, content: a.description, date: new Date(a.date).toLocaleDateString()}));
  const areQuickStatsLoading = !quickStats;

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner user={userProfile} />
      <QuickStats stats={quickStats} isLoading={areQuickStatsLoading} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {(areTodaysClassesLoading || areEnrollmentsLoading || areCoursesLoading) ? (
            <Skeleton className="h-80" />
          ) : (
            todaysClasses && <UpcomingClasses timetable={todaysClasses} />
          )}
        </div>
        {(isAttendanceLoading || areCoursesLoading || areEnrollmentsLoading) ? (
          <Skeleton className="h-80" />
        ) : (
          attendanceData && <AttendanceChart data={attendanceData} />
        )}
      </div>
      {isAnnouncementsLoading ? (
         <Skeleton className="h-64" />
      ) : (
        displayAnnouncements && <RecentAnnouncements announcements={displayAnnouncements} />
      )}
    </div>
  );
}

    