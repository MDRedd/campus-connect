'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, collectionGroup, where, getDocs, DocumentData } from 'firebase/firestore';
import Link from 'next/link';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type Course = { id: string; name: string; code: string; };
type UserProfile = { id: string; name: string; email: string; };
type AttendanceRecord = { studentId: string; courseId: string; status: 'present' | 'absent'; };
type StudentStats = {
    profile: UserProfile;
    attended: number;
    total: number;
    percentage: number;
}

export default function FacultyAttendanceDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const courseId = params.courseId as string;
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

    const courseDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId) return null;
        return doc(firestore, 'courses', courseId);
    }, [firestore, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

    const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[] | null>(null);
    const [areStudentsLoading, setAreStudentsLoading] = useState(true);
    
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[] | null>(null);
    const [areRecordsLoading, setAreRecordsLoading] = useState(true);

    // 1. Fetch all students enrolled in the course
    useEffect(() => {
        if (!firestore || !courseId) return;

        const fetchStudents = async () => {
            setAreStudentsLoading(true);
            try {
                const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', '==', courseId));
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const studentIds = enrollmentsSnapshot.docs.map(d => d.data().studentId as string);

                if (studentIds.length > 0) {
                    const studentsData: UserProfile[] = [];
                    // Chunk the studentIds array to handle the 'in' query limit of 30
                    for (let i = 0; i < studentIds.length; i += 30) {
                        const chunk = studentIds.slice(i, i + 30);
                        const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                        const studentsSnapshot = await getDocs(studentsQuery);
                        studentsSnapshot.forEach(doc => studentsData.push(doc.data() as UserProfile));
                    }
                    setEnrolledStudents(studentsData);
                } else {
                    setEnrolledStudents([]);
                }
            } catch (error) {
                console.error("Error fetching enrolled students:", error);
                setEnrolledStudents([]);
            } finally {
                setAreStudentsLoading(false);
            }
        };
        fetchStudents();
    }, [firestore, courseId]);

    // 2. Fetch all attendance records for this course
    useEffect(() => {
        if (!firestore || !courseId) return;

        const fetchRecords = async () => {
            setAreRecordsLoading(true);
            try {
                const recordsQuery = query(collectionGroup(firestore, 'attendance'), where('courseId', '==', courseId));
                const recordsSnapshot = await getDocs(recordsQuery);
                const records = recordsSnapshot.docs.map(d => {
                    const data = d.data() as Omit<AttendanceRecord, 'studentId'>;
                    const studentId = d.ref.parent.parent?.id; // attendance is in a subcollection of user
                    return { ...data, studentId: studentId! }
                });
                setAttendanceRecords(records);
            } catch (error) {
                console.error("Error fetching attendance records:", error);
                setAttendanceRecords([]);
            } finally {
                setAreRecordsLoading(false);
            }
        };
        fetchRecords();
    }, [firestore, courseId]);

    // 3. Compute stats
    const studentStats = useMemo<StudentStats[] | null>(() => {
        if (!enrolledStudents || !attendanceRecords) return null;

        const recordStats: Record<string, { attended: number; total: number }> = {};

        for (const record of attendanceRecords) {
            if (!recordStats[record.studentId]) {
                recordStats[record.studentId] = { attended: 0, total: 0 };
            }
            recordStats[record.studentId].total++;
            if (record.status === 'present') {
                recordStats[record.studentId].attended++;
            }
        }
        
        return enrolledStudents.map(student => {
            const stats = recordStats[student.id] || { attended: 0, total: 0 };
            return {
                profile: student,
                attended: stats.attended,
                total: stats.total,
                percentage: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
            }
        }).sort((a, b) => a.profile.name.localeCompare(b.profile.name));

    }, [enrolledStudents, attendanceRecords]);
    
    const isLoading = isCourseLoading || areStudentsLoading || areRecordsLoading;

    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            
            {isCourseLoading ? <Skeleton className="h-10 w-1/2" /> : (
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">{course?.name}</h1>
                    <p className="text-muted-foreground">Attendance records for all enrolled students.</p>
                </div>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Student Attendance</CardTitle>
                    <CardDescription>Overview of attendance percentages for this course.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Classes Attended</TableHead>
                                <TableHead className="w-[300px]">Attendance %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : studentStats && studentStats.length > 0 ? (
                                studentStats.map(stat => (
                                    <TableRow key={stat.profile.id}>
                                        <TableCell>
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={stat.profile.name} data-ai-hint={userAvatar.imageHint} />}
                                                <AvatarFallback>{stat.profile.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                                </Avatar>
                                                <div className="font-medium">{stat.profile.name}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{stat.attended} / {stat.total}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <Progress value={stat.percentage} className="h-2 flex-1" />
                                                <span className="w-12 text-right font-medium">{stat.percentage}%</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No students enrolled or no attendance data available for this course.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    )
}
