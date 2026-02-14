'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, getDocs, query, where, collectionGroup, doc } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin, PlusCircle, Pencil, Trash2 } from 'lucide-react';
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

type UserProfile = {
  role: 'student' | 'faculty' | 'admin';
};

const timetableSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  dayOfWeek: z.string().min(1, 'Please select a day.'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM).'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM).'),
  room: z.string().min(1, 'Room is required.'),
  meetingUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  semester: z.string().min(3, 'Semester is required.'),
  year: z.coerce.number().min(new Date().getFullYear(), 'Year cannot be in the past.'),
});


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
    const { toast } = useToast();
    
    const [openDialog, setOpenDialog] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Timetable | null>(null);

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [firestore, authUser]);
    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

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

                    if (isStudentMatch || isFacultyMatch) {
                        const course = courseMap.get(data.courseId);
                        if (course) {
                            allTimetableEntries.push({ id: doc.id, ...data, course: { name: course.name, code: course.code } } as Timetable);
                        }
                    }
                });
            
            allTimetableEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setFullTimetable(allTimetableEntries);
          } catch (error) {
            console.error("Error fetching timetable:", error);
            setFullTimetable([]);
          } finally {
            setIsTimetableLoading(false);
          }
        };
    
        fetchTimetable();
      }, [firestore, userProfile, authUser, allCourses, areAllCoursesLoading, enrolledCourses, areEnrollmentsLoading, facultyCourses, areFacultyCoursesLoading]);

      const timetableByDay = useMemo(() => {
        if (!fullTimetable) return null;
        return daysOfWeek.reduce((acc, day) => {
            acc[day] = fullTimetable.filter(t => t.dayOfWeek === day);
            return acc;
        }, {} as Record<string, Timetable[]>);
      }, [fullTimetable]);

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
        if (!firestore || !authUser) return;

        if (editingSlot) {
            const slotRef = doc(firestore, 'courses', editingSlot.courseId, 'timetables', editingSlot.id);
            // Non-blocking update
            updateDocumentNonBlocking(slotRef, values);
            toast({ title: 'Success', description: 'Timetable slot updated.' });
        } else {
            // Non-blocking create
            const timetableRef = collection(firestore, 'courses', values.courseId, 'timetables');
            addDocumentNonBlocking(timetableRef, {
                ...values,
                facultyId: authUser.uid,
            });
            toast({ title: 'Success', description: 'Timetable slot added.' });
        }
        
        setOpenDialog(false);
        setEditingSlot(null);
      }

      const isLoading = isAuthUserLoading || isUserProfileLoading || isTimetableLoading;
      const today = new Date().toLocaleString('en-US', { weekday: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Class Timetable</h1>
            <p className="text-muted-foreground">
            {userProfile?.role === 'faculty' ? "Manage your weekly class schedule." : "Your weekly class schedule."}
            </p>
        </div>
        {userProfile?.role === 'faculty' && (
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> {editingSlot ? 'Edit Slot' : 'Add Slot'}</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSlot ? 'Edit Timetable Slot' : 'Add New Timetable Slot'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onTimetableSubmit)} className="space-y-4">
                            <FormField control={form.control} name="courseId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Course</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingSlot}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                    <SelectContent>{facultyCourses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )} />
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
                </DialogContent>
            </Dialog>
        )}
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
                      <li key={entry.id} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{entry.course.name}</p>
                          <p className="text-sm text-muted-foreground">{entry.course.code}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm mt-2 sm:mt-0">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>Room: {entry.room}</span>
                            </div>
                             {userProfile?.role === 'faculty' && (
                                <div className="flex gap-2 sm:ml-4">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(entry)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(entry)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
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
