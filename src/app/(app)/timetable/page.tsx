
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, getDocs, query, where, collectionGroup, doc } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card';
import { Clock, MapPin, PlusCircle, Pencil, Trash2, Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import { cn } from '@/lib/utils';
import React from 'react';

type UserProfile = { id: string; name: string; role: string; };

type Timetable = {
    id: string;
    courseId: string;
    facultyId: string;
    dayOfWeek: string;
    startTime: string;
    endTime:string;
    room: string;
    meetingUrl?: string;
    semester: string;
    year: number;
    course: {
        name: string;
        code: string;
    }
};

const timetableSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  facultyId: z.string().optional(), // Optional for faculty, required for admin
  dayOfWeek: z.string().min(1, 'Please select a day.'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM).'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM).'),
  room: z.string().min(1, 'Room is required.'),
  meetingUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  semester: z.string().min(3, 'Semester is required.'),
  year: z.coerce.number().min(new Date().getFullYear(), 'Year cannot be in the past.'),
}).refine(data => data.endTime > data.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
});


const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

const START_HOUR = 8;
const END_HOUR = 18;

const timeLabels = Array.from({ length: (END_HOUR - START_HOUR) }, (_, i) => {
    const hour = START_HOUR + i;
    return `${String(hour).padStart(2, '0')}:00`;
});

// Helper to convert time string (e.g., "09:30") to a grid row number.
const timeToRow = (time: string) => {
    if (!time || !time.includes(':')) return 1;
    const [hours, minutes] = time.split(':').map(Number);
    // Calculate the number of 30-minute intervals from the start hour
    const totalIntervals = (hours - START_HOUR) * 2 + (minutes / 30);
    return totalIntervals + 1; // grid rows are 1-indexed
};

const dayToCol = (day: string) => {
    return daysOfWeek.indexOf(day) + 2; // +2 because col 1 is for time labels
};


export default function TimetablePage() {
    const { user: authUser, profile: userProfile, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [openDialog, setOpenDialog] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Timetable | null>(null);

    const canManageTimetable = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');
    const isAdmin = !!userProfile?.role.includes('admin');

    const coursesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'courses');
    }, [firestore]);
    const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(coursesQuery);
    
    const enrollmentsQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || userProfile?.role !== 'student') return null;
        return collection(firestore, 'users', authUser.uid, 'enrollments');
    }, [firestore, authUser, userProfile]);
    const { data: enrollments, isLoading: areEnrollmentsLoading } = useCollection<{courseId: string}>(enrollmentsQuery);
    
    const enrolledCourses = useMemo(() => {
        if (!enrollments || !allCourses) return null;
        const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
        return allCourses.filter(course => enrolledCourseIds.has(course.id));
    }, [enrollments, allCourses]);

    const [fullTimetable, setFullTimetable] = useState<Timetable[] | null>(null);
    const [isTimetableLoading, setIsTimetableLoading] = useState(true);

    const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

    const allFacultyQuery = useMemoFirebase(() => {
        if (!firestore || !isAdmin) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'faculty'));
    }, [firestore, isAdmin]);
    const { data: allFaculty, isLoading: areFacultyUsersLoading } = useCollection<UserProfile>(allFacultyQuery);


    useEffect(() => {
        if (!firestore || !userProfile || !authUser || areAllCoursesLoading || !allCourses) return;

        const fetchTimetable = async () => {
          setIsTimetableLoading(true);
          const allTimetableEntries: Timetable[] = [];
          
          try {
                const timetablesQuery = query(collectionGroup(firestore, 'timetables'));
                const querySnapshot = await getDocs(timetablesQuery);
                const courseMap = new Map(allCourses.map(c => [c.id, c]));

                const studentCourseIds = new Set(enrolledCourses?.map(c => c.id) ?? []);

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const isStudentMatch = userProfile.role === 'student' && studentCourseIds.has(data.courseId);
                    const isFacultyMatch = userProfile.role === 'faculty' && data.facultyId === authUser.uid;
                    const canView = isStudentMatch || isFacultyMatch || isAdmin;

                    if (canView) {
                        const course = courseMap.get(data.courseId);
                        if (course) {
                            allTimetableEntries.push({ id: doc.id, ...data, course: { name: course.name, code: course.code } } as Timetable);
                        }
                    }
                });
            
            allTimetableEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setFullTimetable(allTimetableEntries);
          } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'timetables', operation: 'list' }));
            setFullTimetable([]);
          } finally {
            setIsTimetableLoading(false);
          }
        };
    
        fetchTimetable();
      }, [firestore, userProfile, authUser, allCourses, areAllCoursesLoading, enrolledCourses, areEnrollmentsLoading, isAdmin]);


      const form = useForm<z.infer<typeof timetableSchema>>({
          resolver: zodResolver(timetableSchema),
          defaultValues: { year: new Date().getFullYear(), semester: 'Fall' }
      });
      
    const handleAddNew = () => {
        setEditingSlot(null);
        form.reset({ year: new Date().getFullYear(), semester: 'Fall', meetingUrl: '' });
        setOpenDialog(true);
    };

    const handleEdit = (slot: Timetable) => {
        setEditingSlot(slot);
        form.reset({
            courseId: slot.courseId,
            facultyId: slot.facultyId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: slot.room,
            meetingUrl: slot.meetingUrl || '',
            semester: slot.semester,
            year: slot.year,
        });
        setOpenDialog(true);
    };

    const handleDelete = (slot: Timetable) => {
        if (!firestore) return;
        if (!confirm('Are you sure you want to delete this timetable slot?')) return;
        const slotRef = doc(firestore, 'courses', slot.courseId, 'timetables', slot.id);
        deleteDocumentNonBlocking(slotRef);
        toast({ title: 'Success', description: 'Timetable slot deleted.' });
    };

      function onTimetableSubmit(values: z.infer<typeof timetableSchema>) {
        if (!firestore || !authUser || !userProfile) return;

        let finalValues: any = { ...values };

        if (isAdmin) {
          if (!values.facultyId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a faculty member.'});
            return;
          }
        } else { // Is Faculty
          finalValues.facultyId = authUser.uid;
        }

        if (editingSlot) {
            const slotRef = doc(firestore, 'courses', editingSlot.courseId, 'timetables', editingSlot.id);
            updateDocumentNonBlocking(slotRef, finalValues);
            toast({ title: 'Success', description: 'Timetable slot updated.' });
        } else {
            const timetableRef = collection(firestore, 'courses', values.courseId, 'timetables');
            addDocumentNonBlocking(timetableRef, finalValues);
            toast({ title: 'Success', description: 'Timetable slot added.' });
        }
        
        setOpenDialog(false);
        setEditingSlot(null);
      }

      const isLoading = isUserLoading || isTimetableLoading;
      const coursesForForm = isAdmin ? allCourses : facultyCourses;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Class Timetable</h1>
            <p className="text-muted-foreground">
            {canManageTimetable ? "Manage your weekly class schedule." : "Your weekly class schedule."}
            </p>
        </div>
        {canManageTimetable && (
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> {editingSlot ? 'Edit Slot' : 'Add Slot'}</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSlot ? 'Edit Timetable Slot' : 'Add New Timetable Slot'}</DialogTitle></DialogHeader>
                    { (areFacultyCoursesLoading || areFacultyUsersLoading) ? <Skeleton className="h-96" /> : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onTimetableSubmit)} className="space-y-4">
                            <FormField control={form.control} name="courseId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Course</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingSlot}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                    <SelectContent>{coursesForForm?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )} />

                            {isAdmin && (
                                <FormField control={form.control} name="facultyId" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Faculty</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a faculty member" /></SelectTrigger></FormControl>
                                        <SelectContent>{allFaculty?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            <FormField control={form.control} name="dayOfWeek" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Day of Week</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger></FormControl>
                                    <SelectContent>{daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )} />
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="startTime" render={({ field }) => ( <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input placeholder="e.g., 09:00" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="endTime" render={({ field }) => ( <FormItem><FormLabel>End Time</FormLabel><FormControl><Input placeholder="e.g., 10:30" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <FormField control={form.control} name="room" render={({ field }) => ( <FormItem><FormLabel>Room</FormLabel><FormControl><Input placeholder="e.g., A-101" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="meetingUrl" render={({ field }) => ( <FormItem><FormLabel>Online Meeting URL (Optional)</FormLabel><FormControl><Input type="url" placeholder="https://meet.google.com/..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="semester" render={({ field }) => ( <FormItem><FormLabel>Semester</FormLabel><FormControl><Input placeholder="e.g., Fall" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="year" render={({ field }) => ( <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">{editingSlot ? 'Save Changes' : 'Add Slot'}</Button></DialogFooter>
                        </form>
                    </Form>
                    )}
                </DialogContent>
            </Dialog>
        )}
      </div>
      
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            {isLoading ? <Skeleton className="h-[600px] w-full" /> : (
            <div
                className="grid relative"
                style={{
                    gridTemplateColumns: '4rem repeat(5, 1fr)',
                    gridTemplateRows: `2.5rem repeat(${(END_HOUR - START_HOUR) * 2}, 3rem)`,
                }}
            >
                {/* Column Headers (Days) */}
                <div />
                {daysOfWeek.map((day, i) => (
                    <div key={day} style={{ gridColumn: i + 2 }} className="text-center font-semibold p-2 border-b">
                        {day}
                    </div>
                ))}
                
                {/* Row Headers (Times) and Grid Lines */}
                {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => {
                    const hour = START_HOUR + Math.floor(i / 2);
                    const minute = (i % 2) * 30;
                    const isHour = minute === 0;

                    return (
                        <React.Fragment key={i}>
                            <div
                                style={{ gridRow: i + 2 }}
                                className={cn("text-right pr-2 text-muted-foreground", isHour ? 'text-xs -translate-y-2' : 'text-[10px] opacity-0')}
                            >
                                {isHour && `${String(hour).padStart(2, '0')}:00`}
                            </div>
                            <div
                                style={{ gridRow: i + 2, gridColumn: '2 / span 5' }}
                                className={cn("border-t", isHour ? "border-border" : "border-dashed")}
                            ></div>
                        </React.Fragment>
                    )
                })}

                {/* Timetable Entries */}
                {fullTimetable?.map((entry, index) => {
                    const rowStart = timeToRow(entry.startTime);
                    const rowEnd = timeToRow(entry.endTime);
                    const col = dayToCol(entry.dayOfWeek);
                    const colorIndex = (entry.courseId.charCodeAt(0) % 5) + 1; // Consistent color per course

                    if (rowStart === null || rowEnd === null || col === null) return null;
                    
                    return (
                        <div
                            key={entry.id}
                            style={{
                                gridRow: `${rowStart} / ${rowEnd}`,
                                gridColumn: col
                            }}
                            className={cn(
                                "relative m-px p-2 flex flex-col rounded-lg border",
                                `bg-chart-${colorIndex}/10 border-chart-${colorIndex}/20 text-chart-${colorIndex}`
                            )}
                        >
                            <p className="font-bold text-sm leading-tight">{entry.course.name}</p>
                            <p className="text-xs">{entry.course.code}</p>
                            <div className="mt-auto space-y-1 text-xs">
                                <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{entry.startTime} - {entry.endTime}</div>
                                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{entry.room}</div>
                            </div>
                            {entry.meetingUrl && (
                                <a href={entry.meetingUrl} target="_blank" rel="noopener noreferrer" className="absolute top-1 right-1 p-1 rounded-full hover:bg-black/10">
                                    <Video className="h-4 w-4" />
                                </a>
                            )}
                            {canManageTimetable && (
                                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(entry)}><Pencil className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => handleDelete(entry)}><Trash2 className="h-3 w-3"/></Button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            )}
        </div>
    </div>
  );

    