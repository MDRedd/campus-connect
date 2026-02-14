'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { User, Users, Activity } from 'lucide-react';
import { format } from 'date-fns';
import type { Course } from '@/lib/data';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import RecentAnnouncements from './components/recent-announcements';
import RoleDistributionChart from './components/role-distribution-chart';
import CourseDepartmentChart from './components/course-department-chart';
import { Skeleton } from '@/components/ui/skeleton';


type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};
type UserProfileData = { name: string; role: string; id: string; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };
type FullUserProfile = { name: string; role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin'; id: string; department?: string };
type RoleData = { name: string; value: number; fill: string; };
type DepartmentChartData = { name: string; count: number };


export default function AdminDashboard({ userProfile }: { userProfile: UserProfileData }) {
    const firestore = useFirestore();

    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    const [areStatsLoading, setAreStatsLoading] = useState(true);
    const [roleDistributionData, setRoleDistributionData] = useState<RoleData[] | null>(null);
    const [courseDepartmentData, setCourseDepartmentData] = useState<DepartmentChartData[] | null>(null);

    const allUsersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: allUsers, isLoading: areAllUsersLoading } = useCollection<FullUserProfile>(allUsersQuery);

    const allCoursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'announcements'), orderBy('date', 'desc'), limit(3));
    }, [firestore]);
    const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);
    
    useEffect(() => {
        if (areAllUsersLoading || !allUsers || areAllCoursesLoading || !allCourses) {
            if (!areAllCoursesLoading && !areAllUsersLoading) setAreStatsLoading(false);
            return;
        }

        setAreStatsLoading(true);
        // Quick Stats
        const studentCount = allUsers.filter(d => d.role === 'student').length;
        const facultyCount = allUsers.filter(d => d.role === 'faculty').length;
        
        setQuickStats([
            { title: 'Total Students', value: studentCount.toString(), icon: User },
            { title: 'Total Faculty', value: facultyCount.toString(), icon: Users },
            { title: 'Total Courses', value: (allCourses?.length ?? 0).toString(), icon: Activity },
        ]);

        // Role Distribution Chart Data
        const roleCounts = allUsers.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        setRoleDistributionData(Object.entries(roleCounts).map(([name, value], index) => ({
            name,
            value,
            fill: ['hsl(var(--primary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'][index % 6]
        })));

        // Course Department Chart Data
        const departmentCounts = allCourses.reduce((acc, course) => {
            const dept = course.department || 'N/A';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        setCourseDepartmentData(Object.entries(departmentCounts).map(([name, count]) => ({name, count})));
        setAreStatsLoading(false);

    }, [allUsers, areAllUsersLoading, allCourses, areAllCoursesLoading]);


    const displayAnnouncements = useMemo(() => {
        if (!announcements) return [];
        return announcements.map(a => ({
            ...a, 
            content: a.description, 
            date: a.date ? format(a.date.toDate(), 'MMM d, yyyy') : '...'
        }));
    }, [announcements]);

    return (
        <div className="flex flex-col gap-6">
            <WelcomeBanner user={userProfile} />
            <QuickStats stats={quickStats} isLoading={areStatsLoading} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {areAllUsersLoading ? <Skeleton className="h-80" /> : roleDistributionData && <RoleDistributionChart data={roleDistributionData} />}
                {areAllCoursesLoading ? <Skeleton className="h-80" /> : courseDepartmentData && <CourseDepartmentChart data={courseDepartmentData} />}
            </div>

            {areAnnouncementsLoading ? (
                <Skeleton className="h-64" />
            ) : (
                displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
            )}
        </div>
    );
}
