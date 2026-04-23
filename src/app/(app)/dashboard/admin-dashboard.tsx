'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, where } from 'firebase/firestore';
import { User, Users, Activity, BarChart3, Database, ShieldAlert, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import type { Course } from '@/lib/data';

import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import RecentAnnouncements from './components/recent-announcements';
import RoleDistributionChart from '././components/role-distribution-chart';
import CourseDepartmentChart from './components/course-department-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import PlatformGuide from './components/platform-guide';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';

type QuickStat = {
  title: string;
  value: string;
  icon: React.ElementType;
};
type UserProfileData = { name: string; role: string; id: string; };
type Announcement = { id: string; title: string; description: string; date: any; targetAudience: 'all' | 'students' | 'faculty'; };
type FullUserProfile = { name: string; role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin'; id: string; department?: string; auditStatus?: string; email: string };
type RoleData = { name: string; value: number; fill: string; };
type DepartmentChartData = { name: string; count: number };


export default function AdminDashboard({ userProfile }: { userProfile: UserProfileData }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

    const [quickStats, setQuickStats] = useState<QuickStat[] | null>(null);
    const [areStatsLoading, setAreStatsLoading] = useState(true);
    const [roleDistributionData, setRoleDistributionData] = useState<RoleData[] | null>(null);
    const [courseDepartmentData, setCourseDepartmentData] = useState<DepartmentChartData[] | null>(null);

    const allUsersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: allUsers, isLoading: areAllUsersLoading } = useCollection<FullUserProfile>(allUsersQuery);

    const pendingAudits = useMemo(() => {
        if (!allUsers) return [];
        return allUsers.filter(u => u.auditStatus === 'pending').slice(0, 5);
    }, [allUsers]);

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
            { title: 'Registered Students', value: studentCount.toString(), icon: User },
            { title: 'Academic Faculty', value: facultyCount.toString(), icon: Users },
            { title: 'Active Curriculums', value: (allCourses?.length ?? 0).toString(), icon: Activity },
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
            const dept = (course as any).department || 'N/A';
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

    const handleVerifyUser = (userId: string) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'users', userId), { auditStatus: 'verified' });
        toast({ title: 'Persona Authorized', description: 'Identity ledger synchronized successfully.' });
    };

    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-1000">
            <WelcomeBanner user={userProfile} />
            <PlatformGuide role={userProfile.role as any} />
            <QuickStats stats={quickStats} isLoading={areStatsLoading} />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Identity Audit Terminal */}
                <div className="lg:col-span-8 space-y-8">
                    <Card className="glass-card border-none overflow-hidden shadow-2xl">
                        <CardHeader className="bg-primary/5 border-b border-indigo-50/50 p-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                        <ShieldAlert className="h-3.5 w-3.5" /> Identity Audit HUD
                                    </div>
                                    <CardTitle className="text-3xl font-black tracking-tight uppercase">Pending Persona Audits</CardTitle>
                                    <CardDescription className="text-xs font-medium text-slate-500">Authorize new system participants and define departmental alignment.</CardDescription>
                                </div>
                                <Badge variant="destructive" className={cn("px-4 py-1.5 rounded-xl font-black text-[10px] tracking-widest uppercase", pendingAudits.length > 0 ? "animate-pulse" : "opacity-30")}>{pendingAudits.length} Action Required</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {areAllUsersLoading ? <div className="p-8 space-y-4"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div> : (
                                pendingAudits.length > 0 ? (
                                    <div className="divide-y divide-indigo-50/30">
                                        {pendingAudits.map(user => (
                                            <div key={user.id} className="p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                                                <div className="flex items-center gap-6">
                                                    <Avatar className="h-14 w-14 border-2 border-white shadow-xl group-hover:scale-110 transition-all duration-500 ring-4 ring-primary/5">
                                                        {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={user.name} />}
                                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">{user.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="space-y-1">
                                                        <p className="font-black text-slate-800 uppercase tracking-tight text-lg leading-none">{user.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                                            <span className="text-primary">{user.email}</span>
                                                            <span className="opacity-20">•</span>
                                                            <span>Requested: {user.role.replace('-', ' ')}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Button size="lg" onClick={() => handleVerifyUser(user.id)} className="rounded-xl h-11 px-8 font-black uppercase tracking-widest text-[10px] bg-green-600 hover:bg-green-700 shadow-xl shadow-green-500/20">
                                                        <CheckCircle className="mr-2 h-4 w-4" /> Authorize Persona
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-24 text-center flex flex-col items-center gap-6 opacity-20">
                                        <div className="bg-green-500/10 p-10 rounded-full"><CheckCircle className="h-16 w-16 text-green-600" /></div>
                                        <p className="font-black uppercase tracking-[0.3em] text-xs">Identity Ledger Synchronized</p>
                                    </div>
                                )
                            )}
                        </CardContent>
                        <CardFooter className="bg-slate-50/50 p-6 justify-center border-t border-indigo-50/50">
                            <Button asChild variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em] w-full hover:bg-white transition-all">
                                <Link href="/users">Launch Master Directory HUD <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            </Button>
                        </CardFooter>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <Card className="glass-card border-none shadow-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
                                    <BarChart3 className="h-5 w-5 text-primary" />
                                    Identity Demographics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {areAllUsersLoading ? <Skeleton className="h-80 w-full rounded-[2rem]" /> : roleDistributionData && <RoleDistributionChart data={roleDistributionData} />}
                            </CardContent>
                        </Card>

                        <Card className="glass-card border-none shadow-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
                                    <Database className="h-5 w-5 text-accent" />
                                    Departmental Node Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {areAllCoursesLoading ? <Skeleton className="h-80 w-full rounded-[2rem]" /> : courseDepartmentData && <CourseDepartmentChart data={courseDepartmentData} />}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                     <Card className="glass-card border-none shadow-2xl sticky top-28">
                        <CardHeader className="bg-primary/5 p-8 border-b border-white/10">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Governance HUD</CardTitle>
                            <CardDescription className="text-xs font-medium">Direct access to institutional master controls.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 p-8">
                            <Button variant="secondary" className="w-full justify-between h-14 rounded-2xl group transition-all hover:bg-white hover:shadow-xl" asChild>
                                <Link href="/users" className="flex justify-between items-center w-full px-2">
                                    <span className="font-black uppercase tracking-widest text-[10px]">Persona Directory</span>
                                    <ArrowRight className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-primary" />
                                </Link>
                            </Button>
                            <Button variant="secondary" className="w-full justify-between h-14 rounded-2xl group transition-all hover:bg-white hover:shadow-xl" asChild>
                                <Link href="/courses" className="flex justify-between items-center w-full px-2">
                                    <span className="font-black uppercase tracking-widest text-[10px]">Master Course Catalog</span>
                                    <ArrowRight className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-primary" />
                                </Link>
                            </Button>
                            <Button variant="secondary" className="w-full justify-between h-14 rounded-2xl group transition-all hover:bg-white hover:shadow-xl" asChild>
                                <Link href="/fees" className="flex justify-between items-center w-full px-2">
                                    <span className="font-black uppercase tracking-widest text-[10px]">Financial Settlement Ledger</span>
                                    <ArrowRight className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-primary" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {areAnnouncementsLoading ? (
                        <Skeleton className="h-64 w-full rounded-[2rem]" />
                    ) : (
                        displayAnnouncements && displayAnnouncements.length > 0 && <RecentAnnouncements announcements={displayAnnouncements} />
                    )}
                </div>
            </div>
        </div>
    );
}
