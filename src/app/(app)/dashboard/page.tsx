
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, getDocs, collectionGroup } from 'firebase/firestore';
import { BookOpen, Percent, FileWarning, Users, CheckCircle, User, Activity } from 'lucide-react';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses, { UpcomingClass } from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';
import StudentsAtRisk from './components/students-at-risk';
import RoleDistributionChart from './components/role-distribution-chart';
import CourseDepartmentChart from './components/course-department-chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Course } from '@/lib/data';
import { format } from 'date-fns';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};

type Assignment = { id: string; courseId: string; deadline: string; };
type Submission = { id: string; courseId: string; assignmentId: string; marksAwarded?: number; };
type UserProfileData = { name: string; role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin'; id: string; department?: string };
type Enrollment = { courseId: string };
type AttendanceRecord = { courseId: string; status: 'present' | 'absent'; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };
type AtRiskStudent = {
  studentId: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  percentage: number;
};
type RoleData = { name: string; value: number; fill: string; };
type DepartmentChartData = { name: string; count: number };


export default function DashboardPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
  const [areStatsLoading, setAreStatsLoading] = useState(true);
  
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[] | null>(null);
  const [areAtRiskStudentsLoading, setAreAtRiskStudentsLoading] = useState(true);

  const [roleDistributionData, setRoleDistributionData] = useState<RoleData[] | null>(null);
  const [courseDepartmentData, setCourseDepartmentData] = useState<DepartmentChartData[] | null>(null);

  // --- Common Data ---
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfileData>(userDocRef);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));
  }, [firestore]);
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

  const allUsersQuery = useMemoFirebase(() => {
      if (!firestore || !userProfile?.role.includes('admin')) return null;
      return collection(firestore, 'users');
  }, [firestore, userProfile]);
  const { data: allUsers, isLoading: areAllUsersLoading } = useCollection<UserProfileData>(allUsersQuery);
  
  const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

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
        
        if (areFacultyCoursesLoading || !facultyCourses) {
          if (!areFacultyCoursesLoading) setAreStatsLoading(false);
          return;
        }

        let studentCount = 0;
        let submissionsToGrade = 0;

        if (facultyCourses.length > 0) {
            const facultyCourseIds = facultyCourses.map(c => c.id);
            const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', 'in', facultyCourseIds));
            const submissionsQuery = query(collectionGroup(firestore, 'submissions'), where('courseId', 'in', facultyCourseIds));
            
            const [enrollmentsSnapshot, submissionsSnapshot] = await Promise.all([getDocs(enrollmentsQuery), getDocs(submissionsQuery)]);
            
            studentCount = new Set(enrollmentsSnapshot.docs.map(d => d.data().studentId)).size;
            submissionsToGrade = submissionsSnapshot.docs.filter(d => d.data().marksAwarded === undefined || d.data().marksAwarded === null).length;
        }

        stats = [
          { title: 'Active Courses', value: (facultyCourses?.length ?? 0).toString(), icon: BookOpen },
          { title: 'Total Students', value: studentCount.toString(), icon: Users },
          { title: 'Submissions to Grade', value: submissionsToGrade.toString(), icon: CheckCircle },
        ];
      } else if (userProfile.role.includes('admin')) {
        if (areAllUsersLoading || !allUsers) {
            if(!areAllUsersLoading) setAreStatsLoading(false);
            return;
        }
        
        const studentCount = allUsers.filter(d => d.role === 'student').length;
        const facultyCount = allUsers.filter(d => d.role === 'faculty').length;
        
        stats = [
          { title: 'Total Students', value: studentCount.toString(), icon: User },
          { title: 'Total Faculty', value: facultyCount.toString(), icon: Users },
          { title: 'Total Courses', value: (allCourses?.length ?? 0).toString(), icon: Activity },
        ];

        // Admin charts data
        const roleCounts = allUsers.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        setRoleDistributionData(Object.entries(roleCounts).map(([name, value], index) => ({
            name,
            value,
            fill: ['hsl(var(--primary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'][index % 6]
        })));
        
        const departmentCounts = allCourses.reduce((acc, course) => {
            const dept = course.department || 'N/A';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        setCourseDepartmentData(Object.entries(departmentCounts).map(([name, count]) => ({name, count})));
      }
      setQuickStats(stats);
      setAreStatsLoading(false);
    };

    calculateStats();
  }, [userProfile, isUserProfileLoading, firestore, allCourses, areAllCoursesLoading, studentEnrollments, areStudentEnrollmentsLoading, studentAttendance, isStudentAttendanceLoading, authUser, facultyCourses, areFacultyCoursesLoading, allUsers, areAllUsersLoading]);

  // --- At-Risk Students calculation for faculty ---
  useEffect(() => {
    if (userProfile?.role !== 'faculty' || !firestore || areFacultyCoursesLoading || !facultyCourses) {
        if(userProfile?.role === 'faculty') setAreAtRiskStudentsLoading(false);
        return;
    }
    
    const calculateAtRiskStudents = async () => {
        setAreAtRiskStudentsLoading(true);
        try {
            if (facultyCourses.length === 0) {
                setAtRiskStudents([]);
                setAreAtRiskStudentsLoading(false);
                return;
            }

            const facultyCourseIds = facultyCourses.map(c => c.id);

            const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', 'in', facultyCourseIds));
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            const studentIds = [...new Set(enrollmentsSnapshot.docs.map(d => d.data().studentId as string))];

            if (studentIds.length === 0) {
                setAtRiskStudents([]);
                setAreAtRiskStudentsLoading(false);
                return;
            }

            const studentsData: UserProfileData[] = [];
            for (let i = 0; i < studentIds.length; i += 30) {
                const chunk = studentIds.slice(i, i + 30);
                const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                const studentsSnapshot = await getDocs(studentsQuery);
                studentsSnapshot.forEach(doc => studentsData.push({...(doc.data() as Omit<UserProfileData, 'id'>), id: doc.id }));
            }
            const studentMap = new Map(studentsData.map(s => [s.id, s.name]));

            const attendanceQuery = query(collectionGroup(firestore, 'attendance'), where('courseId', 'in', facultyCourseIds));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const allRecords = attendanceSnapshot.docs.map(d => {
                const studentId = d.ref.parent.parent!.id;
                return { ...(d.data() as AttendanceRecord), studentId };
            });

            const stats: Record<string, { attended: number; total: number }> = {};
            allRecords.forEach(rec => {
                if (studentIds.includes(rec.studentId)) { 
                    const key = `${rec.studentId}-${rec.courseId}`;
                    if (!stats[key]) stats[key] = { attended: 0, total: 0 };
                    stats[key].total++;
                    if (rec.status === 'present') stats[key].attended++;
                }
            });

            const atRisk: AtRiskStudent[] = [];
            const courseMap = new Map(facultyCourses.map(c => [c.id, c.code]));
            Object.entries(stats).forEach(([key, { attended, total }]) => {
                const percentage = total > 0 ? (attended / total) * 100 : 0;
                if (total > 3 && percentage < 75) {
                    const [studentId, courseId] = key.split('-');
                    const studentName = studentMap.get(studentId);
                    const courseCode = courseMap.get(courseId);
                    if (studentName && courseCode) {
                        atRisk.push({ studentId, studentName, courseId, courseCode, percentage: Math.round(percentage) });
                    }
                }
            });
            setAtRiskStudents(atRisk);
        } catch (error) {
            console.error("Error calculating at-risk students:", error);
            setAtRiskStudents([]);
        } finally {
            setAreAtRiskStudentsLoading(false);
        }
    };
    calculateAtRiskStudents();
  }, [userProfile, firestore, facultyCourses, areFacultyCoursesLoading]);


  // --- Data for other components ---
  const [todaysClasses, setTodaysClasses] = useState<UpcomingClass[] | null>(null);
  const [areTodaysClassesLoading, setAreTodaysClassesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !userProfile || !authUser || !allCourses) return;

    const fetchTodaysClasses = async () => {
        setAreTodaysClassesLoading(true);
        const today = new Date().toLocaleString('en-US', { weekday: 'long' });
        const allClasses: UpcomingClass[] = [];

        try {
            if (userProfile.role === 'student') {
                if (areStudentEnrollmentsLoading || !studentEnrollments) {
                  if(!areStudentEnrollmentsLoading) setAreTodaysClassesLoading(false);
                  return;
                };
                if (studentEnrollments.length === 0) {
                    setTodaysClasses([]);
                    setAreTodaysClassesLoading(false);
                    return;
                }
                const enrolledCourseIds = studentEnrollments.map(e => e.courseId);
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('courseId', 'in', enrolledCourseIds));
                const querySnapshot = await getDocs(timetablesQuery);
                const courseMap = new Map(allCourses.map(c => [c.id, c]));
                querySnapshot.docs
                    .filter(doc => doc.data().dayOfWeek === today)
                    .forEach(doc => {
                        const data = doc.data();
                        const course = courseMap.get(data.courseId);
                        if (course) {
                            allClasses.push({ id: doc.id, ...data, course: { name: course.name } } as UpcomingClass);
                        }
                    });

            } else if (userProfile.role === 'faculty') {
                if (areFacultyCoursesLoading || !facultyCourses) {
                  if(!areFacultyCoursesLoading) setAreTodaysClassesLoading(false);
                  return;
                }
                if (facultyCourses.length === 0) {
                    setTodaysClasses([]);
                    setAreTodaysClassesLoading(false);
                    return;
                }
                 const facultyCourseIds = facultyCourses.map(c => c.id);
                 const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('courseId', 'in', facultyCourseIds), where('facultyId', '==', authUser.uid));
                 const querySnapshot = await getDocs(timetablesQuery);
                 const courseMap = new Map(facultyCourses.map(c => [c.id, c]));
                 querySnapshot.docs
                    .filter(doc => doc.data().dayOfWeek === today)
                    .forEach(doc => {
                        const data = doc.data();
                        const course = courseMap.get(data.courseId);
                        if (course) {
                            allClasses.push({ id: doc.id, ...data, course: { name: course.name } } as UpcomingClass);
                        }
                    });

            } else { // Admin
                 setTodaysClasses([]);
                 setAreTodaysClassesLoading(false);
                 return;
            }
            
            allClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setTodaysClasses(allClasses);
        } catch (error) {
            console.error("Error fetching timetable:", error);
            setTodaysClasses([]);
        } finally {
            setAreTodaysClassesLoading(false);
        }
    };
    fetchTodaysClasses();
  }, [firestore, userProfile, authUser, allCourses, studentEnrollments, areStudentEnrollmentsLoading, areFacultyCoursesLoading, facultyCourses]);

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

  const displayAnnouncements = useMemo(() => {
    if (!announcements || !userProfile) return [];
    
    const announcementsWithFormattedDate = announcements.map(a => ({
        ...a, 
        content: a.description, 
        date: a.date ? format(a.date.toDate(), 'MMM d, yyyy') : '...'
    }));

    if (userProfile.role.includes('admin')) {
        return announcementsWithFormattedDate;
    }

    const targetAudiences = ['all', userProfile.role];
    return announcementsWithFormattedDate.filter(a => targetAudiences.includes(a.targetAudience));

  }, [announcements, userProfile]);

  const isPageLoading = isAuthUserLoading || isUserProfileLoading;

  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-6">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-24" />
            <div className="grid gap-6 lg:grid-cols-3">
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

  const isAdmin = userProfile.role.includes('admin');

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner user={userProfile} />
      <QuickStats stats={quickStats} isLoading={areStatsLoading} />
      
      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {areAllUsersLoading ? <Skeleton className="h-80" /> : roleDistributionData && <RoleDistributionChart data={roleDistributionData} />}
           {areAllCoursesLoading ? <Skeleton className="h-80" /> : courseDepartmentData && <CourseDepartmentChart data={courseDepartmentData} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                {areTodaysClassesLoading ? (
                    <Skeleton className="h-80" />
                ) : (
                    todaysClasses && <UpcomingClasses timetable={todaysClasses} />
                )}
            </div>
            {userProfile.role === 'student' && (
                <div className="lg:col-span-1">
                    {isStudentAttendanceLoading || areAllCoursesLoading ? (
                        <Skeleton className="h-80" />
                    ) : (
                        attendanceData && <AttendanceChart data={attendanceData} />
                    )}
                </div>
            )}
        </div>
      )}

       {userProfile.role === 'faculty' && (
            areAtRiskStudentsLoading ? (
                <Skeleton className="h-64" />
            ) : (
                atRiskStudents && <StudentsAtRisk students={atRiskStudents} />
            )
        )}
      
      {areAnnouncementsLoading ? (
         <Skeleton className="h-64" />
      ) : (
        displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
      )}
    </div>
  );
}
