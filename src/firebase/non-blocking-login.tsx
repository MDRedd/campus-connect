'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call createUserWithEmailAndPassword directly. Do NOT use 'await createUserWithEmailAndPassword(...)'.
  createUserWithEmailAndPassword(authInstance, email, password).catch((signUpError) => {
    // This catch block prevents unhandled promise rejections if sign-up fails
    // (e.g., if the user already exists and a wrong password was provided on the login attempt).
    // In a production app, you would handle this error more gracefully.
    console.error("Sign-up error:", signUpError);
  });
}

/** Initiate email/password sign-in (non-blocking), with a fallback to sign-up. */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error) => {
      // If sign-in fails because the user doesn't exist, try to create a new user.
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        initiateEmailSignUp(authInstance, email, password);
      } else {
        // For other errors (e.g., wrong password for an existing user, network issues),
        // we'll log them. A real app should provide user feedback.
        console.error("Sign-in error:", error);
      }
    });
}
