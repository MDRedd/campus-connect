'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type Timetable = {
    id: string;
    courseId: string;
    facultyId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string;
    semester: string;
    year: number;
    course: {
        name: string;
        code: string;
    }
};

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

export default function TimetablePage() {
    const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
    const firestore = useFirestore();

    const coursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);
    
    const enrollmentsQuery = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return collection(firestore, 'users', authUser.uid, 'enrollments');
    }, [firestore, authUser]);
    const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<{courseId: string}>(enrollmentsQuery);
    
    const enrolledCourses = useMemo(() => {
        if (!enrollments || !allCourses) return null;
        const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
        return allCourses.filter(course => enrolledCourseIds.has(course.id));
    }, [enrollments, allCourses]);

    const [fullTimetable, setFullTimetable] = useState<Timetable[] | null>(null);
    const [isTimetableLoading, setIsTimetableLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !enrolledCourses) {
            if (enrolledCourses === null) return; // Still loading
             setFullTimetable([]);
             setIsTimetableLoading(false);
            return;
        };
        if (enrolledCourses.length === 0) {
            setFullTimetable([]);
            setIsTimetableLoading(false);
            return;
        }
    
        const fetchTimetable = async () => {
          setIsTimetableLoading(true);
          const allTimetableEntries: Timetable[] = [];
    
          try {
            for (const course of enrolledCourses) {
                const timetablesQuery = query(
                    collection(firestore, 'courses', course.id, 'timetables')
                );
                const querySnapshot = await getDocs(timetablesQuery);
                querySnapshot.forEach((doc) => {
                    allTimetableEntries.push({
                        id: doc.id,
                        ...doc.data(),
                        course: { name: course.name, code: course.code }
                    } as Timetable);
                });
            }
            allTimetableEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setFullTimetable(allTimetableEntries);
          } catch (error) {
            console.error("Error fetching timetable:", error);
            setFullTimetable([]);
          }
          setIsTimetableLoading(false);
        };
    
        fetchTimetable();
      }, [firestore, enrolledCourses]);

      const timetableByDay = useMemo(() => {
        if (!fullTimetable) return null;
        return daysOfWeek.reduce((acc, day) => {
            acc[day] = fullTimetable.filter(t => t.dayOfWeek === day);
            return acc;
        }, {} as Record<string, Timetable[]>);
      }, [fullTimetable]);

      const isLoading = isAuthUserLoading || areCoursesLoading || areEnrollmentsLoading || isTimetableLoading;
      const today = new Date().toLocaleString('en-US', { weekday: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Class Timetable</h1>
        <p className="text-muted-foreground">
          Your weekly class schedule.
        </p>
      </div>

      <Tabs defaultValue={daysOfWeek.includes(today) ? today : 'Monday'} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {daysOfWeek.map((day) => (
            <TabsTrigger key={day} value={day}>
              {day}
            </TabsTrigger>
          ))}
        </TabsList>

        {daysOfWeek.map((day) => (
          <TabsContent key={day} value={day} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{day}'s Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : timetableByDay && timetableByDay[day].length > 0 ? (
                  <ul className="space-y-4">
                    {timetableByDay[day].map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{entry.course.name}</p>
                          <p className="text-sm text-muted-foreground">{entry.course.code}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>Room: {entry.room}</span>
                            </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No classes scheduled for {day}.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
