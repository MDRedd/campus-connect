'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Briefcase, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
  department?: string;
};
type Course = { id: string; name: string; code: string; };
type Enrollment = { courseId: string; };

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const userId = params.userId as string;
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');
  
  const { profile: viewingUserProfile } = useUser();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);
  const { data: user, isLoading: isUserLoading } = useDoc<UserProfile>(userDocRef);

  // For Students: Get their enrolled courses
  const enrollmentsQuery = useMemoFirebase(() => {
    if (!firestore || user?.role !== 'student' || !userId) return null;
    return collection(firestore, 'users', userId, 'enrollments');
  }, [firestore, user, userId]);
  const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courses');
  }, [firestore]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);
  
  const enrolledCourses = useMemo(() => {
    if (user?.role !== 'student' || !enrollments || !allCourses) return null;
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
    return allCourses.filter(course => enrolledCourseIds.has(course.id));
  }, [enrollments, allCourses, user]);

  // For Faculty: Get courses they teach
  const [facultyCourses, setFacultyCourses] = useState<Course[] | null>(null);
  const [areFacultyCoursesLoading, setAreFacultyCoursesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user || user.role !== 'faculty') {
        setFacultyCourses(null);
        setAreFacultyCoursesLoading(false);
        return;
    }

    const fetchFacultyCourses = async () => {
        setAreFacultyCoursesLoading(true);
        try {
            const timetablesQuery = query(collectionGroup(firestore, 'timetables'), where('facultyId', '==', user.id));
            const timetableSnapshot = await getDocs(timetablesQuery);

            if (timetableSnapshot.empty) {
                setFacultyCourses([]);
                return;
            }

            const facultyCourseIds = [...new Set(timetableSnapshot.docs.map(doc => doc.data().courseId as string))];

            if (facultyCourseIds.length > 0 && allCourses) {
                const courseMap = new Map(allCourses.map(c => [c.id, c]));
                const coursesData = facultyCourseIds
                    .map(id => courseMap.get(id))
                    .filter((c): c is Course => c !== undefined);
                setFacultyCourses(coursesData);
            } else {
                setFacultyCourses([]);
            }
        } catch (error) {
            console.error("Error fetching faculty courses for profile:", error);
            setFacultyCourses([]);
        } finally {
            setAreFacultyCoursesLoading(false);
        }
    };
    
    if (!areAllCoursesLoading) {
        fetchFacultyCourses();
    }
  }, [firestore, user, allCourses, areAllCoursesLoading]);


  const isLoading = isUserLoading || areEnrollmentsLoading || areAllCoursesLoading || areFacultyCoursesLoading;
  const userInitials = user?.name.split(' ').map((n) => n[0]).join('');

  const isMyProfile = viewingUserProfile?.id === userId;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {isLoading ? (
        <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : user ? (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32 text-4xl">
                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={user.name} data-ai-hint={userAvatar.imageHint} />}
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
              <Badge variant="secondary" className="capitalize">{user.role.replace('-', ' ')}</Badge>
              {isMyProfile && (
                <Button asChild className="w-full mt-4">
                  <Link href="/profile">Edit Profile</Link>
                </Button>
              )}
            </CardContent>
          </Card>
          
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Details</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                 <div className="flex items-center gap-4">
                    <p className="w-24 text-muted-foreground">Role</p>
                    <p className="font-medium capitalize">{user.role.replace('-', ' ')}</p>
                </div>
                {user.department && (
                     <div className="flex items-center gap-4">
                        <p className="w-24 text-muted-foreground">Department</p>
                        <p className="font-medium">{user.department}</p>
                    </div>
                )}
              </CardContent>
            </Card>

            {user.role === 'student' && enrolledCourses && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Enrolled Courses</CardTitle></CardHeader>
                <CardContent>
                    {enrolledCourses.length > 0 ? (
                        <div className="space-y-2">
                            {enrolledCourses.map(course => (
                                <Link href={`/courses/${course.id}`} key={course.id} className="block p-2 rounded-md hover:bg-muted">
                                    <p className="font-semibold">{course.name}</p>
                                    <p className="text-sm text-muted-foreground">{course.code}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not enrolled in any courses.</p>
                    )}
                </CardContent>
              </Card>
            )}

            {user.role === 'faculty' && facultyCourses && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Courses Taught</CardTitle></CardHeader>
                <CardContent>
                    {facultyCourses.length > 0 ? (
                        <div className="space-y-2">
                            {facultyCourses.map(course => (
                                <Link href={`/courses/${course.id}`} key={course.id} className="block p-2 rounded-md hover:bg-muted">
                                    <p className="font-semibold">{course.name}</p>
                                    <p className="text-sm text-muted-foreground">{course.code}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not assigned to teach any courses currently.</p>
                    )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User Not Found</CardTitle>
            <CardDescription>The user you are looking for does not exist.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
