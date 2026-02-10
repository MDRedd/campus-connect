'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import Link from 'next/link';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type Course = { id: string; name: string; code: string; };
type Attendance = { id: string; date: any; status: 'present' | 'absent' };

export default function StudentAttendanceDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const courseId = params.courseId as string;

    const courseDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId) return null;
        return doc(firestore, 'courses', courseId);
    }, [firestore, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

    const attendanceQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || !courseId) return null;
        return query(
            collection(firestore, 'users', authUser.uid, 'attendance'), 
            where('courseId', '==', courseId),
            orderBy('date', 'desc')
        );
    }, [firestore, authUser, courseId]);
    const { data: attendanceRecords, isLoading: areRecordsLoading } = useCollection<Attendance>(attendanceQuery);

    const isLoading = isCourseLoading || areRecordsLoading;

    const getStatusVariant = (status: 'present' | 'absent') => {
        switch (status) {
            case 'present':
                return 'default';
            case 'absent':
                return 'destructive';
            default:
                return 'secondary';
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Attendance
            </Button>
            
            {isCourseLoading ? <Skeleton className="h-10 w-1/2" /> : (
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">{course?.name}</h1>
                    <p className="text-muted-foreground">Your detailed attendance history for {course?.code}.</p>
                </div>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Attendance Log</CardTitle>
                    <CardDescription>A record of your attendance for each class session.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={2}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : attendanceRecords && attendanceRecords.length > 0 ? (
                                attendanceRecords.map(record => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            {record.date ? format(record.date.toDate(), 'PPP') : '...'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={getStatusVariant(record.status)} className="capitalize">
                                                {record.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center">
                                        No attendance records found for this course.
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
