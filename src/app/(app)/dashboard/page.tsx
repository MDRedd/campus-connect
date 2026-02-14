'use client';

import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
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
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);

  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfileData>(userDocRef);

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
    );
  }

  if (!userProfile) {
    return <div>Could not load user profile. Please try logging in again.</div>;
  }
  
  const isAdmin = userProfile.role.includes('admin');

  if (isAdmin) {
    return <AdminDashboard userProfile={userProfile} />;
  }

  if (userProfile.role === 'faculty') {
    return <FacultyDashboard userProfile={userProfile} />;
  }
  
  if (userProfile.role === 'student') {
    return <StudentDashboard userProfile={userProfile} />;
  }
  
  return <div>Invalid user role.</div>;
}
