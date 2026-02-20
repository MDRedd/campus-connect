
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, query, collectionGroup, where, getDocs, DocumentData, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, Pencil, Trash2, PlusCircle, Search, FilterX } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';


// Types
type Course = { id: string; name: string; code: string; };
type UserProfile = { id: string; name: string; email: string; };
type AttendanceRecord = { id: string; studentId: string; courseId: string; status: 'present' | 'absent'; date: any; markedBy: string; };
type StudentStats = {
    profile: UserProfile;
    attended: number;
    total: number;
    percentage: number;
}
const attendanceSchema = z.object({
  date: z.string().min(1, 'Date is required.'),
  status: z.enum(['present', 'absent']),
});
type AttendanceFormValues = z.infer<typeof attendanceSchema>;


export default function FacultyAttendanceDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();
    const courseId = params.courseId as string;
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

    const [managingStudent, setManagingStudent] = useState<UserProfile | null>(null);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const courseDocRef = useMemoFirebase(() => {
        if (!firestore || !courseId) return null;
        return doc(firestore, 'courses', courseId);
    }, [firestore, courseId]);
    const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

    const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[] | null>(null);
    const [areStudentsLoading, setAreStudentsLoading] = useState(true);
    
    const [courseAttendanceRecords, setCourseAttendanceRecords] = useState<AttendanceRecord[] | null>(null);
    const [areRecordsLoading, setAreRecordsLoading] = useState(true);

    const form = useForm<AttendanceFormValues>({
        resolver: zodResolver(attendanceSchema),
    });

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
            } catch (error: any) {
                console.error("Error fetching students for course:", error);
                if (error.code === 'permission-denied') {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'enrollments', operation: 'list'}));
                }
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
                    const data = d.data() as Omit<AttendanceRecord, 'id' | 'studentId'>;
                    const studentId = d.ref.parent.parent?.id; // attendance is in a subcollection of user
                    return { ...data, id: d.id, studentId: studentId! }
                });
                setCourseAttendanceRecords(records);
            } catch (error: any) {
                console.error("Error fetching attendance records for course:", error);
                if (error.code === 'permission-denied') {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'attendance', operation: 'list'}));
                }
                setCourseAttendanceRecords([]);
            } finally {
                setAreRecordsLoading(false);
            }
        };
        fetchRecords();
    }, [firestore, courseId, managingStudent]);

    // 3. Compute stats
    const studentStats = useMemo<StudentStats[] | null>(() => {
        if (!enrolledStudents || !courseAttendanceRecords) return null;

        const recordStats: Record<string, { attended: number; total: number }> = {};

        for (const record of courseAttendanceRecords) {
            if (!recordStats[record.studentId]) {
                recordStats[record.studentId] = { attended: 0, total: 0 };
            }
            recordStats[record.studentId].total++;
            if (record.status === 'present') {
                recordStats[record.studentId].attended++;
            }
        }
        
        return enrolledStudents
            .map(student => {
                const stats = recordStats[student.id] || { attended: 0, total: 0 };
                return {
                    profile: student,
                    attended: stats.attended,
                    total: stats.total,
                    percentage: stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
                }
            })
            .filter(stat => 
                stat.profile.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                stat.profile.email.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => a.profile.name.localeCompare(b.profile.name));

    }, [enrolledStudents, courseAttendanceRecords, searchQuery]);
    
    const individualStudentRecords = useMemo(() => {
        if (!managingStudent || !courseAttendanceRecords) return [];
        return courseAttendanceRecords
            .filter(r => r.studentId === managingStudent.id)
            .sort((a,b) => b.date.toDate() - a.date.toDate());
    }, [managingStudent, courseAttendanceRecords]);

    const handleManageClick = (student: UserProfile) => {
        setManagingStudent(student);
        form.reset();
        setEditingRecord(null);
    };

    const handleEditClick = (record: AttendanceRecord) => {
        setEditingRecord(record);
        form.reset({
            date: format(record.date.toDate(), 'yyyy-MM-dd'),
            status: record.status,
        });
    };

    const handleDelete = (record: AttendanceRecord) => {
        if (!firestore) return;
        if (!confirm('Are you sure you want to delete this record?')) return;
        deleteDocumentNonBlocking(doc(firestore, 'users', record.studentId, 'attendance', record.id));
        toast({ title: 'Record Deleted' });
    };

    const onFormSubmit = (values: AttendanceFormValues) => {
        if (!firestore || !authUser || !managingStudent || !courseId) return;

        const recordData = {
            courseId: courseId,
            date: new Date(values.date),
            status: values.status,
            markedBy: authUser.uid,
        };

        if (editingRecord) {
            updateDocumentNonBlocking(doc(firestore, 'users', editingRecord.studentId, 'attendance', editingRecord.id), recordData);
            toast({ title: 'Record Updated' });
        } else {
            addDocumentNonBlocking(collection(firestore, 'users', managingStudent.id, 'attendance'), recordData);
            toast({ title: 'Record Added' });
        }
        form.reset();
        setEditingRecord(null);
    };
    
    const isLoading = isCourseLoading || areStudentsLoading || areRecordsLoading;

    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                {isCourseLoading ? <Skeleton className="h-10 w-1/2" /> : (
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">{course?.name}</h1>
                        <p className="text-muted-foreground">Attendance records for all enrolled students.</p>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search students..." 
                            className="pl-8 w-[250px]" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {searchQuery && (
                        <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')}>
                            <FilterX className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Enrolled Students</CardTitle>
                    <CardDescription>Overview of cumulative attendance percentages for this course.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Classes Attended</TableHead>
                                <TableHead className="w-[300px]">Attendance %</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
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
                                                <Link href={`/users/${stat.profile.id}`} className="font-medium hover:underline">
                                                    {stat.profile.name}
                                                </Link>
                                            </div>
                                        </TableCell>
                                        <TableCell>{stat.attended} / {stat.total}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <Progress value={stat.percentage} className="h-2 flex-1" />
                                                <span className="w-12 text-right font-medium">{stat.percentage}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleManageClick(stat.profile)}>Manage</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        {searchQuery ? 'No students match your search.' : 'No students enrolled or no attendance data available.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Dialog open={!!managingStudent} onOpenChange={(isOpen) => !isOpen && setManagingStudent(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Manage Attendance for {managingStudent?.name}</DialogTitle>
                        <DialogDescription>Manually add, edit, or delete attendance records for {course?.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="space-y-4">
                            <h3 className="font-semibold">{editingRecord ? 'Edit Record' : 'Add New Record'}</h3>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 rounded-lg border p-4">
                                     <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                     <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="present">Present</SelectItem>
                                                <SelectItem value="absent">Absent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="flex justify-end gap-2">
                                        {editingRecord && <Button type="button" variant="ghost" onClick={() => { setEditingRecord(null); form.reset(); }}>Cancel Edit</Button>}
                                        <Button type="submit"><PlusCircle className="mr-2 h-4 w-4" />{editingRecord ? 'Save Changes' : 'Add Record'}</Button>
                                    </div>
                                </form>
                            </Form>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold">Existing Records</h3>
                            <div className="border rounded-lg max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {individualStudentRecords.length > 0 ? (
                                        individualStudentRecords.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell>{format(rec.date.toDate(), 'PPP')}</TableCell>
                                                <TableCell><Badge variant={rec.status === 'present' ? 'default' : 'destructive'} className="capitalize">{rec.status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(rec)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rec)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">No records found.</TableCell></TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
