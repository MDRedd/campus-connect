'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, limit, where, getDocs, collectionGroup } from 'firebase/firestore';
import { BookOpen, Users, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Course } from '@/lib/data';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses, { UpcomingClass } from './components/upcoming-classes';
import RecentAnnouncements from './components/recent-announcements';
import StudentsAtRisk from './components/students-at-risk';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import AcademicallyAtRisk from './components/academically-at-risk';

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};
type UserProfileData = { name: string; role: 'faculty'; id: string; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };
type AtRiskStudent = { studentId: string; studentName: string; courseId: string; courseCode: string; percentage: number; };
type AttendanceRecord = { courseId: string; status: 'present' | 'absent'; };
type FullUserProfile = { name: string; role: string; id: string; department?: string };
type AcademicallyAtRiskStudent = { studentId: string; studentName: string; courseId: string; courseCode: string; grade: string; marks: number; };
type ResultRecord = { studentId: string; courseId: string; grade: string; marks: number; published: boolean };

export default function FacultyDashboard({ userProfile }: { userProfile: UserProfileData }) {
    const { user: authUser } = useUser();
    const firestore = useFirestore();

    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    const [areStatsLoading, setAreStatsLoading] = useState(true);
    const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[] | null>(null);
    const [areAtRiskStudentsLoading, setAreAtRiskStudentsLoading] = useState(true);
    const [todaysClasses, setTodaysClasses] = useState<UpcomingClass[] | null>(null);
    const [areTodaysClassesLoading, setAreTodaysClassesLoading] = useState(true);
    const [academicallyAtRisk, setAcademicallyAtRisk] = useState<AcademicallyAtRiskStudent[] | null>(null);
    const [areAcademicallyAtRiskLoading, setAreAcademicallyAtRiskLoading] = useState(true);

    const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));
    }, [firestore]);
    const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);
    
    useEffect(() => {
        if (!firestore || !facultyCourses || areFacultyCoursesLoading) {
            if (!areFacultyCoursesLoading) setAreStatsLoading(false);
            return;
        }

        const calculateStats = async () => {
            setAreStatsLoading(true);
            try {
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
    
                setQuickStats([
                    { title: 'Active Courses', value: (facultyCourses?.length ?? 0).toString(), icon: BookOpen },
                    { title: 'Total Students', value: studentCount.toString(), icon: Users },
                    { title: 'Submissions to Grade', value: submissionsToGrade.toString(), icon: CheckCircle },
                ]);
            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'enrollments or submissions', operation: 'list'}));
                setQuickStats([]);
            } finally {
                setAreStatsLoading(false);
            }
        };
        calculateStats();
    }, [firestore, facultyCourses, areFacultyCoursesLoading]);

    useEffect(() => {
        if (!firestore || areFacultyCoursesLoading || !facultyCourses) {
            if(!areFacultyCoursesLoading) setAreAtRiskStudentsLoading(false);
            return;
        }
        
        const calculateAtRiskStudents = async () => {
            setAreAtRiskStudentsLoading(true);
            try {
                if (facultyCourses.length === 0) {
                    setAtRiskStudents([]);
                    return;
                }
                const facultyCourseIds = facultyCourses.map(c => c.id);
                const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', 'in', facultyCourseIds));
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const studentIds = [...new Set(enrollmentsSnapshot.docs.map(d => d.data().studentId as string))];

                if (studentIds.length === 0) {
                    setAtRiskStudents([]);
                    return;
                }

                const studentsData: FullUserProfile[] = [];
                for (let i = 0; i < studentIds.length; i += 30) {
                    const chunk = studentIds.slice(i, i + 30);
                    const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                    const studentsSnapshot = await getDocs(studentsQuery);
                    studentsSnapshot.forEach(doc => studentsData.push({...(doc.data() as Omit<FullUserProfile, 'id'>), id: doc.id }));
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
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'enrollments, users, or attendance', operation: 'list'}));
                setAtRiskStudents([]);
            } finally {
                setAreAtRiskStudentsLoading(false);
            }
        };
        calculateAtRiskStudents();
    }, [firestore, facultyCourses, areFacultyCoursesLoading]);

    useEffect(() => {
        if (!firestore || !userProfile || !authUser || areFacultyCoursesLoading || !facultyCourses) {
            if(!areFacultyCoursesLoading) setAreTodaysClassesLoading(false);
            return;
        }

        const fetchTodaysClasses = async () => {
            setAreTodaysClassesLoading(true);
            const today = new Date().toLocaleString('en-US', { weekday: 'long' });
            if (facultyCourses.length === 0) {
                setTodaysClasses([]);
                setAreTodaysClassesLoading(false);
                return;
            }
            try {
                const facultyCourseIds = facultyCourses.map(c => c.id);
                 const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('courseId', 'in', facultyCourseIds), where('facultyId', '==', authUser.uid));
                 const querySnapshot = await getDocs(timetablesQuery);
                 const courseMap = new Map(facultyCourses.map(c => [c.id, c]));
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
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'timetables', operation: 'list' }));
                setTodaysClasses([]);
            } finally {
                setAreTodaysClassesLoading(false);
            }
        };
        fetchTodaysClasses();
      }, [firestore, userProfile, authUser, facultyCourses, areFacultyCoursesLoading]);
      
      useEffect(() => {
        if (!firestore || areFacultyCoursesLoading || !facultyCourses) {
            if(!areFacultyCoursesLoading) setAreAcademicallyAtRiskLoading(false);
            return;
        }

        const calculateAcademicallyAtRisk = async () => {
            setAreAcademicallyAtRiskLoading(true);
            try {
                if (facultyCourses.length === 0) {
                    setAcademicallyAtRisk([]);
                    return;
                }

                const facultyCourseIds = facultyCourses.map(c => c.id);
                const resultsQuery = query(collectionGroup(firestore, 'results'), where('courseId', 'in', facultyCourseIds));
                const resultsSnapshot = await getDocs(resultsQuery);
                
                const allResults: ResultRecord[] = resultsSnapshot.docs.map(d => {
                    const studentId = d.ref.parent.parent!.id;
                    return { ...(d.data() as Omit<ResultRecord, 'studentId'>), studentId };
                });

                const atRiskResults = allResults.filter(r => ['D', 'F'].includes(r.grade.toUpperCase()) || r.marks < 50);

                if (atRiskResults.length === 0) {
                    setAcademicallyAtRisk([]);
                    return;
                }

                const studentIds = [...new Set(atRiskResults.map(r => r.studentId))];
                const studentsData: FullUserProfile[] = [];
                 for (let i = 0; i < studentIds.length; i += 30) {
                    const chunk = studentIds.slice(i, i + 30);
                    const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                    const studentsSnapshot = await getDocs(studentsQuery);
                    studentsSnapshot.forEach(doc => studentsData.push({...(doc.data() as Omit<FullUserProfile, 'id'>), id: doc.id }));
                }
                const studentMap = new Map(studentsData.map(s => [s.id, s.name]));
                const courseMap = new Map(facultyCourses.map(c => [c.id, c.code]));

                const finalAtRiskList = atRiskResults.map(r => ({
                    studentId: r.studentId,
                    studentName: studentMap.get(r.studentId) || 'Unknown',
                    courseId: r.courseId,
                    courseCode: courseMap.get(r.courseId) || 'N/A',
                    grade: r.grade,
                    marks: r.marks,
                })).filter(s => s.studentName !== 'Unknown');

                setAcademicallyAtRisk(finalAtRiskList);

            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'results or users', operation: 'list'}));
                setAcademicallyAtRisk([]);
            } finally {
                setAreAcademicallyAtRiskLoading(false);
            }
        };

        calculateAcademicallyAtRisk();

    }, [firestore, facultyCourses, areFacultyCoursesLoading]);

    const displayAnnouncements = useMemo(() => {
        if (!announcements) return [];
        return announcements
            .filter(a => a.targetAudience === 'all' || a.targetAudience === 'faculty')
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
            
            <div className="grid grid-cols-1 gap-6">
                {areTodaysClassesLoading ? (
                    <Skeleton className="h-80" />
                ) : (
                    todaysClasses && <UpcomingClasses timetable={todaysClasses} />
                )}
            </div>

            {areAtRiskStudentsLoading ? (
                <Skeleton className="h-64" />
            ) : (
                atRiskStudents && <StudentsAtRisk students={atRiskStudents} />
            )}

            {areAcademicallyAtRiskLoading ? (
                <Skeleton className="h-64" />
            ) : (
                academicallyAtRisk && <AcademicallyAtRisk students={academicallyAtRisk} />
            )}
            
            {areAnnouncementsLoading ? (
                <Skeleton className="h-64" />
            ) : (
                displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
            )}
        </div>
    );
}
