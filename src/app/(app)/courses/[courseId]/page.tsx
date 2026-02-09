'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query, collectionGroup, where, getDocs, DocumentData } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookCopy, Building, Star, FileText, Download, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';

type Course = {
  id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
};
type UserProfile = { role: 'student' | 'faculty' | 'admin', name: string, id: string, email: string };
type Assignment = { id: string; title: string; description: string; deadline: string; };
type StudyMaterial = { id: string; title: string; description: string; fileUrl: string; };

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const courseId = params.courseId as string;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  const assignmentsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return collection(firestore, 'courses', courseId, 'assignments');
  }, [firestore, courseId]);
  const { data: assignments, isLoading: areAssignmentsLoading } = useCollection<Assignment>(assignmentsQuery);

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return collection(firestore, 'courses', courseId, 'study_materials');
  }, [firestore, courseId]);
  const { data: materials, isLoading: areMaterialsLoading } = useCollection<StudyMaterial>(materialsQuery);

  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[] | null>(null);
  const [areStudentsLoading, setAreStudentsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !courseId || userProfile?.role === 'student') {
        setAreStudentsLoading(false);
        return;
    }

    const fetchEnrolledStudents = async () => {
        setAreStudentsLoading(true);
        try {
            const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', '==', courseId));
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            const studentIds = enrollmentsSnapshot.docs.map(d => d.data().studentId as string);

            if (studentIds.length > 0) {
                // Firestore 'in' query has a limit of 30 items.
                // For this app, we'll assume classes are smaller than that.
                const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', studentIds));
                const studentsSnapshot = await getDocs(studentsQuery);
                const students = studentsSnapshot.docs.map(d => d.data() as UserProfile);
                setEnrolledStudents(students);
            } else {
                setEnrolledStudents([]);
            }
        } catch (error) {
            console.error("Error fetching enrolled students:", error);
            setEnrolledStudents([]);
        } finally {
            setAreStudentsLoading(false);
        }
    }

    fetchEnrolledStudents();

  }, [firestore, courseId, userProfile]);

  const isDataLoading = areAssignmentsLoading || areMaterialsLoading || (userProfile?.role !== 'student' && areStudentsLoading);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        {isCourseLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-32" />
            </div>
        ) : course ? (
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
                <p className="text-muted-foreground">{course.code}</p>
            </div>
        ) : (
            <h1 className="text-3xl font-bold tracking-tight">Course Not Found</h1>
        )}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {isCourseLoading ? (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-48" />
            </CardContent>
        </Card>
      ) : course ? (
        <Tabs defaultValue="assignments" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="materials">Study Materials</TabsTrigger>
                {userProfile?.role !== 'student' && <TabsTrigger value="students">Students</TabsTrigger>}
            </TabsList>
            <TabsContent value="assignments" className="mt-6">
                <Card>
                    <CardHeader><CardTitle>Assignments</CardTitle><CardDescription>All assignments for {course.name}.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? (
                            <Skeleton className="h-32 w-full" />
                        ) : assignments && assignments.length > 0 ? (
                            assignments.map(assignment => (
                                <Card key={assignment.id}>
                                    <CardHeader><CardTitle className="text-lg">{assignment.title}</CardTitle></CardHeader>
                                    <CardContent><p className="text-sm text-muted-foreground">{assignment.description}</p></CardContent>
                                    <CardFooter className="flex justify-between items-center">
                                        <p className="text-sm font-medium">Deadline: {format(new Date(assignment.deadline), 'PPP')}</p>
                                        <Button variant="secondary" size="sm">View Details</Button>
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                <FileText className="h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">No Assignments</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Assignments for this course will appear here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="materials" className="mt-6">
                <Card>
                    <CardHeader><CardTitle>Study Materials</CardTitle><CardDescription>All study materials for {course.name}.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : materials && materials.length > 0 ? (
                            materials.map(material => (
                                <Card key={material.id} className="flex items-center justify-between p-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold">{material.title}</h4>
                                        <p className="text-sm text-muted-foreground">{material.description}</p>
                                    </div>
                                    <Button variant="outline" size="sm" asChild><a href={material.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>
                                </Card>
                            ))
                        ) : (
                             <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                <Download className="h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">No Materials</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Study materials for this course will appear here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
             {userProfile?.role !== 'student' && (
                <TabsContent value="students" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Enrolled Students</CardTitle><CardDescription>Students enrolled in {course.name}.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            {isDataLoading ? (
                                 <Skeleton className="h-48 w-full" />
                            ) : enrolledStudents && enrolledStudents.length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {enrolledStudents.map(student => (
                                    <div key={student.id} className="flex items-center gap-4 rounded-lg border p-3">
                                        <Avatar className="h-10 w-10">
                                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={student.name} data-ai-hint="person portrait" />}
                                            <AvatarFallback>{student.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">{student.email}</p>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                    <Users className="h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No Students Enrolled</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">No students are currently enrolled in this course.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
             )}
        </Tabs>
      ) : (
         <Card>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">The course you are looking for does not exist or you do not have permission to view it.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
