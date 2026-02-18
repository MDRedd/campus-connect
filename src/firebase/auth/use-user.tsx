'use client';
import { useFirebase } from '@/firebase/provider';

// This should match the User entity in backend.json for consistency
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  [key: string]: any; // Allow other properties like department, rollNumber etc.
};


export interface UserAuthHookResult {
  user: import('firebase/auth').User | null;
  profile: UserProfile | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const useUser = (): UserAuthHookResult => {
  const { user, profile, isUserLoading, userError } = useFirebase();
  return { user, profile, isUserLoading, userError };
};
