'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
             if (!isAuthUserLoading && !areAllCoursesLoading) {
                setIsLoading(false);
             }
            return;
        }

        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const facultyCourseIds = new Set<string>();
                
                // This is less efficient than a collectionGroup query but avoids the need for a custom index.
                // We check each course to see if the current faculty teaches it.
                const courseChecks = allCourses.map(async (course) => {
                    const timetableQuery = query(
                        collection(firestore, 'courses', course.id, 'timetables'),
                        where('facultyId', '==', authUser.uid),
                        limit(1)
                    );
                    const timetableSnapshot = await getDocs(timetableQuery);
                    if (!timetableSnapshot.empty) {
                        return course.id;
                    }
                    return null;
                });
                
                const results = await Promise.all(courseChecks);
                results.forEach(courseId => {
                    if (courseId) {
                        facultyCourseIds.add(courseId);
                    }
                });

                const courseIds = Array.from(facultyCourseIds);
                if (courseIds.length > 0) {
                    setFacultyCourses(allCourses.filter(course => courseIds.includes(course.id)));
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
