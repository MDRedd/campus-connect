'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, limit, where, getDocs, collectionGroup } from 'firebase/firestore';
import { BookOpen, Percent, FileWarning } from 'lucide-react';
import { format } from 'date-fns';
import type { Course } from '@/lib/data';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses, { UpcomingClass } from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';
import { Skeleton } from '@/components/ui/skeleton';


type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};
type UserProfileData = { name: string; role: 'student'; id: string; };
type Enrollment = { courseId: string };
type Assignment = { id: string; courseId: string; deadline: string; };
type AttendanceRecord = { courseId: string; status: 'present' | 'absent'; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };


export default function StudentDashboard({ userProfile }: { userProfile: UserProfileData }) {
    const { user: authUser } = useUser();
    const firestore = useFirestore();

    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    const [areStatsLoading, setAreStatsLoading] = useState(true);

    // --- Data Hooks ---
    const studentEnrollmentsQuery = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return collection(firestore, 'users', authUser.uid, 'enrollments');
    }, [firestore, authUser]);
    const { data: studentEnrollments, isLoading: areStudentEnrollmentsLoading } = useCollection<Enrollment>(studentEnrollmentsQuery);

    const studentAttendanceQuery = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return collection(firestore, 'users', authUser.uid, 'attendance');
    }, [firestore, authUser]);
    const { data: studentAttendance, isLoading: isStudentAttendanceLoading } = useCollection<AttendanceRecord>(studentAttendanceQuery);
    
    const allCoursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));
    }, [firestore, authUser]);
    const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);

    const [todaysClasses, setTodaysClasses] = useState<UpcomingClass[] | null>(null);
    const [areTodaysClassesLoading, setAreTodaysClassesLoading] = useState(true);

    // --- Derived Data and Effects ---
    useEffect(() => {
        if (!firestore || !allCourses || !authUser || areStudentEnrollmentsLoading || isStudentAttendanceLoading) {
            if (!areStudentEnrollmentsLoading && !isStudentAttendanceLoading) {
                setAreStatsLoading(false);
            }
            return;
        }

        const calculateStats = async () => {
            setAreStatsLoading(true);
            const enrolledCourseIds = new Set(studentEnrollments?.map(e => e.courseId) ?? []);
            const enrolledCourses = allCourses.filter(c => enrolledCourseIds.has(c.id));

            // Overall Attendance
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

            // Assignments Due
            let dueAssignmentsCount = 0;
            if (enrolledCourses.length > 0) {
                const courseIds = enrolledCourses.map(c => c.id);
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

            setQuickStats([
                { title: 'Enrolled Courses', value: (studentEnrollments?.length ?? 0).toString(), icon: BookOpen },
                { title: 'Overall Attendance', value: `${overallAttendance}%`, icon: Percent },
                { title: 'Assignments Due', value: dueAssignmentsCount.toString(), icon: FileWarning },
            ]);
            setAreStatsLoading(false);
        };
        calculateStats();
    }, [firestore, allCourses, authUser, studentEnrollments, areStudentEnrollmentsLoading, studentAttendance, isStudentAttendanceLoading]);

    useEffect(() => {
        if (!firestore || !userProfile || !authUser || !allCourses || areStudentEnrollmentsLoading || !studentEnrollments) {
             if (!areStudentEnrollmentsLoading) setAreTodaysClassesLoading(false);
            return;
        }

        const fetchTodaysClasses = async () => {
            setAreTodaysClassesLoading(true);
            const today = new Date().toLocaleString('en-US', { weekday: 'long' });
            if (studentEnrollments.length === 0) {
                setTodaysClasses([]);
                setAreTodaysClassesLoading(false);
                return;
            }
            try {
                const enrolledCourseIds = studentEnrollments.map(e => e.courseId);
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('courseId', 'in', enrolledCourseIds));
                const querySnapshot = await getDocs(timetablesQuery);
                const courseMap = new Map(allCourses.map(c => [c.id, c]));
                const allClasses: UpcomingClass[] = [];
                querySnapshot.docs
                    .filter(doc => doc.data().dayOfWeek === today)
                    .forEach(doc => {
                        const data = doc.data();
                        const course = courseMap.get(data.courseId);
                        if (course) {
                            allClasses.push({ id: doc.id, ...data, course: { name: course.name } } as UpcomingClass);
                        }
                    });
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
    }, [firestore, userProfile, authUser, allCourses, studentEnrollments, areStudentEnrollmentsLoading]);

    const attendanceData = useMemo(() => {
        if (isStudentAttendanceLoading || areAllCoursesLoading || !studentAttendance || !allCourses || !studentEnrollments) return null;
        const enrolledCourseIds = new Set(studentEnrollments.map(e => e.courseId) ?? []);
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
    }, [studentAttendance, allCourses, studentEnrollments, isStudentAttendanceLoading, areAllCoursesLoading]);

    const displayAnnouncements = useMemo(() => {
        if (!announcements) return [];
        return announcements
            .filter(a => a.targetAudience === 'all' || a.targetAudience === 'student')
            .map(a => ({
                ...a, 
                content: a.description, 
                date: a.date ? format(a.date.toDate(), 'MMM d, yyyy') : '...'
            }));
    }, [announcements]);

    return (
        <div className="flex flex-col gap-6">
            <WelcomeBanner user={userProfile} />
            <QuickStats stats={quickStats} isLoading={areStatsLoading} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {areTodaysClassesLoading ? (
                        <Skeleton className="h-80" />
                    ) : (
                        todaysClasses && <UpcomingClasses timetable={todaysClasses} />
                    )}
                </div>
                <div className="lg:col-span-1">
                    {isStudentAttendanceLoading || areAllCoursesLoading ? (
                        <Skeleton className="h-80" />
                    ) : (
                        attendanceData && <AttendanceChart data={attendanceData} />
                    )}
                </div>
            </div>

            {areAnnouncementsLoading ? (
                <Skeleton className="h-64" />
            ) : (
                displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
            )}
        </div>
    );
}
