'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// This should match the User entity in backend.json for consistency
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  [key: string]: any; // Allow other properties like department, rollNumber etc.
};

interface UserAuthState {
  user: User | null;
  profile: UserProfile | null; // User profile from Firestore
  isLoading: boolean; // Combined loading state for auth and profile
  error: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  // User authentication and profile state
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult {
  user: User | null;
  profile: UserProfile | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [authState, setAuthState] = useState<UserAuthState>({
    user: null,
    profile: null,
    isLoading: true, // Start loading until auth and profile are resolved
    error: null,
  });

  useEffect(() => {
    if (!auth || !firestore) {
      setAuthState({ user: null, profile: null, isLoading: false, error: new Error("Auth service not provided.") });
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userDocRef = doc(firestore, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              setAuthState({ user: firebaseUser, profile: userDocSnap.data() as UserProfile, isLoading: false, error: null });
            } else {
              // Profile doesn't exist, create a default one. This is a fallback for social logins.
              const defaultProfile: UserProfile = {
                id: firebaseUser.uid,
                email: firebaseUser.email || 'unknown@example.com',
                name: firebaseUser.displayName || 'New User',
                role: 'student', // Default role
                department: 'Undeclared',
              };
              await setDoc(userDocRef, defaultProfile);
              setAuthState({ user: firebaseUser, profile: defaultProfile, isLoading: false, error: null });
            }
          } catch (err: any) {
            console.error("FirebaseProvider: Error getting/creating user profile:", err);
            setAuthState({ user: firebaseUser, profile: null, isLoading: false, error: err });
          }
        } else {
          // User is signed out
          setAuthState({ user: null, profile: null, isLoading: false, error: null });
        }
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setAuthState({ user: null, profile: null, isLoading: false, error: error });
      }
    );
    return () => unsubscribe();
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => ({
    areServicesAvailable: !!(firebaseApp && firestore && auth),
    firebaseApp: firebaseApp ?? null,
    firestore: firestore ?? null,
    auth: auth ?? null,
    user: authState.user,
    profile: authState.profile,
    isLoading: authState.isLoading,
    error: authState.error,
  }), [firebaseApp, firestore, auth, authState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    profile: context.profile,
    isLoading: context.isLoading,
    error: context.error,
  };
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, profile, isLoading, error } = useFirebase();
  return { user, profile, isUserLoading: isLoading, userError: error };
};
