'use client';
import { useFirebase } from '../provider';

// Standardized UserProfile type
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  [key: string]: any;
};

export interface UserAuthHookResult {
  user: import('firebase/auth').User | null;
  profile: UserProfile | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook to access the current authenticated user and their Firestore profile.
 */
export const useUser = (): UserAuthHookResult => {
  const { user, profile, isUserLoading, userError } = useFirebase();
  return { user, profile, isUserLoading, userError };
};
