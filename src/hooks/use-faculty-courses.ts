'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import { useToast } from './use-toast';

export function useFacultyCourses() {
    const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
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
                // Step 1: Efficiently find all timetable entries for the current faculty.
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', authUser.uid));
                const timetableSnapshot = await getDocs(timetablesQuery);

                if (timetableSnapshot.empty) {
                    setFacultyCourses([]);
                    setIsLoading(false);
                    return;
                }

                // Step 2: Get unique course IDs from the timetable entries.
                const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

                // Step 3: Fetch the full course documents for those IDs.
                if (facultyCourseIds.length > 0) {
                    const coursesData: Course[] = [];
                    // Firestore 'in' query is limited to 30 items per query. Chunking handles this.
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
        
    }, [firestore, authUser, isUserLoading, toast]);

    return { facultyCourses, isLoading };
}
