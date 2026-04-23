'use client';

import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import StudentDashboard from './student-dashboard';
import FacultyDashboard from './faculty-dashboard';
import AdminDashboard from './admin-dashboard';

type UserProfileData = {
  name: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  id: string;
};

export default function DashboardPage() {
  const { profile: userProfile, isUserLoading } = useUser();

  if (isUserLoading) {
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
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Could not load user profile. Please try logging in again.</p>
      </div>
    );
  }
  
  const role = userProfile.role?.toLowerCase() || '';
  const isAdmin = role.includes('admin');

  if (isAdmin) {
    return <AdminDashboard userProfile={userProfile as UserProfileData} />;
  }

  if (role === 'faculty') {
    return <FacultyDashboard userProfile={userProfile as UserProfileData} />;
  }
  
  if (role === 'student') {
    return <StudentDashboard userProfile={userProfile as UserProfileData} />;
  }
  
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Invalid user role detected. Please contact support.</p>
    </div>
  );
}
