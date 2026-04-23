'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import type { Course } from '@/lib/data';

/**
 * Custom hook to fetch all courses assigned to a faculty member.
 * It uses a collection group query on 'timetables' to find associated course IDs.
 */
export function useFacultyCourses() {
    const { user: authUser, profile: userProfile, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (isUserLoading || !firestore || !authUser) {
             if (!isUserLoading) {
                setIsLoading(false);
                setFacultyCourses([]);
             }
            return;
        }

        // Optimization: If the user is an admin, we don't need to run this 
        // collection group query because they will see all courses anyway.
        // This avoids unnecessary index errors for admin accounts.
        const role = userProfile?.role?.toLowerCase() || '';
        if (role.includes('admin')) {
            setIsLoading(false);
            setFacultyCourses(null);
            return;
        }

        const fetchCourses = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', authUser.uid));
                const timetableSnapshot = await getDocs(timetablesQuery);

                if (timetableSnapshot.empty) {
                    setFacultyCourses([]);
                    setIsLoading(false);
                    return;
                }

                const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

                if (facultyCourseIds.length > 0) {
                    const coursesData: Course[] = [];
                    for (let i = 0; i < facultyCourseIds.length; i += 30) {
                        const chunk = facultyCourseIds.slice(i, i + 30);
                        const coursesQuery = query(collection(firestore, 'courses'), where('id', 'in', chunk));
                        const coursesSnapshot = await getDocs(coursesQuery);
                        coursesSnapshot.forEach(doc => {
                            coursesData.push({ id: doc.id, ...(doc.data() as Omit<Course, 'id'>) });
                        });
                    }
                    setFacultyCourses(coursesData);
                } else {
                    setFacultyCourses([]);
                }
                
            } catch (err: any) {
                console.error("Error fetching faculty courses:", err);
                setError(err);
                setFacultyCourses([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCourses();
        
    }, [firestore, authUser?.uid, isUserLoading, userProfile?.role]);

    return { facultyCourses, isLoading, error };
}
