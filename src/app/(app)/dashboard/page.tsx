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
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!userProfile) {
    return <div>Could not load user profile. Please try logging in again.</div>;
  }
  
  const isAdmin = userProfile.role.includes('admin');

  if (isAdmin) {
    return <AdminDashboard userProfile={userProfile as UserProfileData} />;
  }

  if (userProfile.role === 'faculty') {
    return <FacultyDashboard userProfile={userProfile as UserProfileData} />;
  }
  
  if (userProfile.role === 'student') {
    return <StudentDashboard userProfile={userProfile as UserProfileData} />;
  }
  
  return <div>Invalid user role.</div>;
}
