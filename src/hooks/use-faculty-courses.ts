'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import { useToast } from './use-toast';

/**
 * Custom hook to fetch all courses assigned to a faculty member.
 * It uses a collection group query on 'timetables' to find associated course IDs.
 */
export function useFacultyCourses() {
    const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Wait for auth to initialize
        if (isAuthUserLoading || !firestore || !authUser) {
             if (!isAuthUserLoading) {
                setIsLoading(false);
                setFacultyCourses([]);
             }
            return;
        }

        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                // Step 1: Find all timetable slots for this faculty across all courses
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', authUser.uid));
                const timetableSnapshot = await getDocs(timetablesQuery);

                if (timetableSnapshot.empty) {
                    setFacultyCourses([]);
                    setIsLoading(false);
                    return;
                }

                // Step 2: Get unique course IDs
                const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

                // Step 3: Fetch the course details
                if (facultyCourseIds.length > 0) {
                    const coursesData: Course[] = [];
                    // Chunk because 'in' query limit is 30
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
                
            } catch (error: any) {
                console.error("Error fetching faculty courses:", error);
                
                const isIndexError = error.code === 'failed-precondition' || error.message?.includes('index');
                
                toast({
                    variant: 'destructive',
                    title: isIndexError ? 'Database Index Required' : 'Error fetching courses',
                    description: isIndexError 
                        ? 'This feature requires a database index that is currently being created. Please check the browser console and click the provided link if you haven\'t already.'
                        : 'You may not have the required permissions to view your courses.',
                });
                setFacultyCourses([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCourses();
        
    }, [firestore, authUser, isAuthUserLoading, toast]); // Corrected isAuthUserLoading name

    return { facultyCourses, isLoading };
}
