'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, limit, where, getDocs, collectionGroup } from 'firebase/firestore';
import { BookOpen, Percent, FileWarning, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Course } from '@/lib/data';
import Link from 'next/link';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses, { UpcomingClass } from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';
import { Skeleton } from '@/components/ui/skeleton';
import UpcomingDeadlines, { UpcomingAssignment } from './components/upcoming-deadlines';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};
type UserProfileData = { name: string; role: 'student'; id: string; };
type Enrollment = { courseId: string };
type FullAssignment = { id: string; courseId: string; deadline: string; title: string; };
type AttendanceRecord = { courseId: string; status: 'present' | 'absent'; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };


export default function StudentDashboard({ userProfile }: { userProfile: UserProfileData }) {
    const { user: authUser } = useUser();
    const firestore = useFirestore();

    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    const [areStatsLoading, setAreStatsLoading] = useState(true);
    const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[] | null>(null);
    const [areAssignmentsLoading, setAreAssignmentsLoading] = useState(true);

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
        if (!firestore || !allCourses || !authUser || areStudentEnrollmentsLoading || !studentEnrollments || isStudentAttendanceLoading) {
            if (!areStudentEnrollmentsLoading && !isStudentAttendanceLoading && !areAllCoursesLoading) {
                setAreStatsLoading(false);
                setAreAssignmentsLoading(false);
            }
            return;
        }

        const calculateStatsAndAssignments = async () => {
            setAreStatsLoading(true);
            setAreAssignmentsLoading(true);
            try {
                const enrolledCourseIds = new Set(studentEnrollments.map(e => e.courseId));
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
    
                // Assignments Due & Upcoming Deadlines
                let dueAssignmentsCount = 0;
                let upcoming: UpcomingAssignment[] = [];
                if (enrolledCourses.length > 0) {
                    const courseIds = enrolledCourses.map(c => c.id);
                    const assignmentsQuery = query(collectionGroup(firestore, 'assignments'), where('courseId', 'in', courseIds));
                    const submissionsQuery = query(collectionGroup(firestore, 'submissions'), where('studentId', '==', authUser.uid), where('courseId', 'in', courseIds));
                    const [assignmentsSnapshot, submissionsSnapshot] = await Promise.all([getDocs(assignmentsQuery), getDocs(submissionsQuery)]);
    
                    const submittedAssignmentIds = new Set(submissionsSnapshot.docs.map(doc => doc.data().assignmentId));
                    const now = new Date();
                    const courseMap = new Map(allCourses.map(c => [c.id, c.code]));

                    const allDueAssignments = assignmentsSnapshot.docs.filter(doc => {
                        const assignment = doc.data() as FullAssignment;
                        return new Date(assignment.deadline) > now && !submittedAssignmentIds.has(doc.id);
                    });

                    dueAssignmentsCount = allDueAssignments.length;

                    upcoming = allDueAssignments.map(doc => ({ id: doc.id, ...(doc.data() as Omit<FullAssignment, 'id'>) }))
                        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                        .slice(0, 5) // Get top 5 upcoming
                        .map(assignment => ({
                            ...assignment,
                            courseCode: courseMap.get(assignment.courseId) || 'N/A'
                        }));
                }
                setUpcomingAssignments(upcoming);
    
                setQuickStats([
                    { title: 'Enrolled Courses', value: (studentEnrollments.length).toString(), icon: BookOpen },
                    { title: 'Overall Attendance', value: `${overallAttendance}%`, icon: Percent },
                    { title: 'Assignments Due', value: dueAssignmentsCount.toString(), icon: FileWarning },
                ]);

            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'assignments or submissions', operation: 'list' }));
                setQuickStats([]);
                setUpcomingAssignments([]);
            } finally {
                setAreStatsLoading(false);
                setAreAssignmentsLoading(false);
            }
        };
        calculateStatsAndAssignments();
    }, [firestore, allCourses, areAllCoursesLoading, authUser, studentEnrollments, areStudentEnrollmentsLoading, studentAttendance, isStudentAttendanceLoading]);

    useEffect(() => {
        if (!firestore || !userProfile || !authUser || areAllCoursesLoading || !allCourses || areStudentEnrollmentsLoading || !studentEnrollments) {
             if (!areStudentEnrollmentsLoading && !areAllCoursesLoading) setAreTodaysClassesLoading(false);
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
                const courseMap = new Map(allCourses.map(c => [c.id, c]));
                const allClasses: UpcomingClass[] = [];

                for (const courseId of enrolledCourseIds) {
                    const timetablesQuery = query(
                        collection(firestore, 'courses', courseId, 'timetables'),
                        where('dayOfWeek', '==', today)
                    );
                    const querySnapshot = await getDocs(timetablesQuery);
                    const course = courseMap.get(courseId);
                    if (course) {
                        querySnapshot.forEach(doc => {
                             allClasses.push({ id: doc.id, ...doc.data(), course: { name: course.name } } as UpcomingClass);
                        });
                    }
                }

                allClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
                setTodaysClasses(allClasses);
            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'timetables', operation: 'list' }));
                setTodaysClasses([]);
            } finally {
                setAreTodaysClassesLoading(false);
            }
        };
        fetchTodaysClasses();
    }, [firestore, userProfile, authUser, allCourses, areAllCoursesLoading, studentEnrollments, areStudentEnrollmentsLoading]);

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
            .filter(a => a.targetAudience === 'all' || a.targetAudience === 'students')
            .map(a => ({
                ...a, 
                content: a.description, 
                date: a.date ? format(a.date.toDate(), 'MMM d, yyyy') : '...'
            }));
    }, [announcements]);

    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in zoom-in-95 duration-700">
            <WelcomeBanner user={userProfile} />
            <QuickStats stats={quickStats} isLoading={areStatsLoading} />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    {areTodaysClassesLoading ? (
                        <Skeleton className="h-[400px] w-full rounded-3xl" />
                    ) : (
                        todaysClasses && <UpcomingClasses timetable={todaysClasses} />
                    )}
                     {areAssignmentsLoading ? (
                        <Skeleton className="h-[400px] w-full rounded-3xl" />
                    ) : (
                        upcomingAssignments && <UpcomingDeadlines assignments={upcomingAssignments} />
                    )}
                </div>
                <div className="lg:col-span-4 space-y-8">
                    <div className="glass-card p-1">
                        {isStudentAttendanceLoading || areAllCoursesLoading ? (
                            <Skeleton className="h-80 w-full" />
                        ) : (
                            attendanceData && <AttendanceChart data={attendanceData} />
                        )}
                    </div>
                    
                    <Card className="glass-card border-none shadow-indigo-500/10">
                        <CardHeader>
                            <CardTitle className="text-xl">Quick Links</CardTitle>
                            <CardDescription>Common academic actions.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <Button variant="secondary" className="w-full justify-between h-12 rounded-xl group" asChild>
                                <Link href="/attendance/scan">
                                    Mark Presence (Scan QR)
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </Link>
                            </Button>
                            <Button variant="secondary" className="w-full justify-between h-12 rounded-xl group" asChild>
                                <Link href="/results">
                                    Semester Results
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </Link>
                            </Button>
                            <Button variant="secondary" className="w-full justify-between h-12 rounded-xl group" asChild>
                                <Link href="/helpdesk">
                                    Support Helpdesk
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {areAnnouncementsLoading ? (
                <Skeleton className="h-64 w-full rounded-3xl" />
            ) : (
                displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
            )}
        </div>
    );
}