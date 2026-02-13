'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import { useToast } from './use-toast';

export function useFacultyCourses() {
    const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const allCoursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

    useEffect(() => {
        if (isAuthUserLoading || areAllCoursesLoading || !firestore || !authUser || !allCourses) {
            // Still waiting for dependencies to load
             if (!isAuthUserLoading && !areAllCoursesLoading) {
                setIsLoading(false);
             }
            return;
        }

        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                // 1. Find all timetable entries for this faculty
                const timetablesQuery = query(
                    collectionGroup(firestore, 'timetables'),
                    where('facultyId', '==', authUser.uid)
                );
                const timetableSnapshot = await getDocs(timetablesQuery);

                // 2. Get unique course IDs from the timetable entries
                const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

                // 3. Filter the already fetched allCourses list
                if (facultyCourseIds.length > 0) {
                    setFacultyCourses(allCourses.filter(course => facultyCourseIds.includes(course.id)));
                } else {
                    setFacultyCourses([]);
                }
            } catch (error) {
                console.error("Error fetching faculty courses:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not fetch your courses.',
                });
                setFacultyCourses([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchCourses();
        
    }, [firestore, authUser, allCourses, areAllCoursesLoading, isAuthUserLoading, toast]);

    return { facultyCourses, isLoading };
}
