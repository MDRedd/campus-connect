'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, getDocs, query, where, doc } from 'firebase/firestore';
import type { Course } from '@/lib/data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from '@/components/ui/card';
import { Clock, MapPin, PlusCircle, Pencil, Trash2, Video, AlertCircle, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
    DialogDescription,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  facultyId: z.string().optional().default(''),
  dayOfWeek: z.string().min(1, 'Please select a day.'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time (HH:MM).'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time (HH:MM).'),
  room: z.string().min(1, 'Room is required.'),
  meetingUrl: z.string().url('Invalid URL.').optional().or(z.literal('')),
  semester: z.string().min(3, 'Semester required.'),
  year: z.coerce.number().min(2020),
}).refine(data => data.endTime > data.startTime, { message: "End after Start", path: ["endTime"] });

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 8;
const END_HOUR = 18;

const timeToRow = (time: string) => {
    if (!time || !time.includes(':')) return 1;
    const [hours, minutes] = time.split(':').map(Number);
    return (hours - START_HOUR) * 2 + (minutes / 30) + 1;
};

const dayToCol = (day: string) => daysOfWeek.indexOf(day) + 2;

export default function TimetablePage() {
    const { user: authUser, profile: userProfile, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Timetable | null>(null);
    
    const canManageTimetable = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');
    const isAdmin = !!userProfile?.role.includes('admin');

    const coursesQuery = useMemoFirebase(() => { if (!firestore) return null; return collection(firestore, 'courses'); }, [firestore]);
    const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(coursesQuery);
    
    const enrollmentsQuery = useMemoFirebase(() => { if (!firestore || !authUser || userProfile?.role !== 'student') return null; return collection(firestore, 'users', authUser.uid, 'enrollments'); }, [firestore, authUser, userProfile]);
    const { data: enrollments } = useCollection<{courseId: string}>(enrollmentsQuery);
    
    const enrolledCourses = useMemo(() => { if (!enrollments || !allCourses) return null; const ids = new Set(enrollments.map(e => e.courseId)); return allCourses.filter(c => ids.has(c.id)); }, [enrollments, allCourses]);
    const [fullTimetable, setFullTimetable] = useState<Timetable[] | null>(null);
    const [isTimetableLoading, setIsTimetableLoading] = useState(true);
    const { facultyCourses, isLoading: areFacultyCoursesLoading, error: facultyCoursesError } = useFacultyCourses();
    
    const allFacultyQuery = useMemoFirebase(() => { if (!firestore || !isAdmin) return null; return query(collection(firestore, 'users'), where('role', '==', 'faculty')); }, [firestore, isAdmin]);
    const { data: allFaculty, isLoading: areFacultyUsersLoading } = useCollection<UserProfile>(allFacultyQuery);

    const coursesAvailableForAllocation = useMemo(() => {
        if (isAdmin) return allCourses || [];
        return facultyCourses || [];
    }, [isAdmin, allCourses, facultyCourses]);

    useEffect(() => {
        if (isUserLoading || areAllCoursesLoading || !userProfile || !firestore || !allCourses) return;
        let targetCourses: Course[] | null = null;
        if (userProfile.role === 'student') targetCourses = enrolledCourses;
        else if (userProfile.role === 'faculty') targetCourses = facultyCourses;
        else if (isAdmin) targetCourses = allCourses;

        if (targetCourses === null) { setFullTimetable([]); setIsTimetableLoading(false); return; }
        const fetchTimetable = async () => {
          setIsTimetableLoading(true);
          try {
            const courseMap = new Map(allCourses.map(c => [c.id, c]));
            const timetablePromises = targetCourses!.map(async (course) => {
                const querySnapshot = await getDocs(query(collection(firestore, 'courses', course.id, 'timetables')));
                return querySnapshot.docs.map(doc => {
                    const data = doc.data(); const details = courseMap.get(data.courseId);
                    return details ? { id: doc.id, ...data, course: { name: details.name, code: details.code } } as Timetable : null;
                }).filter((e): e is Timetable => e !== null);
            });
            const results = (await Promise.all(timetablePromises)).flat();
            results.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setFullTimetable(results);
          } catch (error) { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'timetables', operation: 'list' })); setFullTimetable([]); } 
          finally { setIsTimetableLoading(false); }
        };
        fetchTimetable();
      }, [isUserLoading, areAllCoursesLoading, userProfile, firestore, allCourses, enrolledCourses, areFacultyCoursesLoading, facultyCourses, isAdmin]);

    const form = useForm<z.infer<typeof timetableSchema>>({ 
        resolver: zodResolver(timetableSchema), 
        defaultValues: { 
            courseId: '',
            facultyId: '',
            dayOfWeek: '',
            startTime: '09:00',
            endTime: '10:30',
            room: '',
            meetingUrl: '',
            year: new Date().getFullYear(), 
            semester: 'Fall' 
        } 
    });
    
    const handleAddNew = () => { setEditingSlot(null); form.reset({ courseId: '', facultyId: '', dayOfWeek: '', startTime: '09:00', endTime: '10:30', room: '', year: new Date().getFullYear(), semester: 'Fall', meetingUrl: '' }); setOpenDialog(true); };
    const handleEdit = (slot: Timetable) => { setEditingSlot(slot); form.reset({ ...slot, meetingUrl: slot.meetingUrl || '' }); setOpenDialog(true); };
    const handleDelete = (slot: Timetable) => { if (!firestore || !confirm('Delete slot?')) return; deleteDocumentNonBlocking(doc(firestore, 'courses', slot.courseId, 'timetables', slot.id)); toast({ title: 'Success', description: 'Schedule updated.' }); };

    function onTimetableSubmit(values: z.infer<typeof timetableSchema>) {
        if (!firestore || !authUser) return;
        let finalValues = { ...values, facultyId: isAdmin ? values.facultyId : authUser.uid };
        if (editingSlot) updateDocumentNonBlocking(doc(firestore, 'courses', editingSlot.courseId, 'timetables', editingSlot.id), finalValues);
        else addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'timetables'), finalValues);
        setOpenDialog(false); setEditingSlot(null); toast({ title: 'Success', description: 'Identity ledger updated.' });
    }

    const isLoading = isUserLoading || isTimetableLoading;
    const isIndexError = facultyCoursesError?.code === 'failed-precondition' || facultyCoursesError?.message?.toLowerCase().includes('index');

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm"><CalendarIcon className="h-3 w-3" /> Weekly Schedule</div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">CLASS TIMETABLE</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">{canManageTimetable ? "Synchronize academic calendars and manage session venues." : "View your official institutional class distribution for the current term."}</p>
              </div>
              {canManageTimetable && <Button onClick={handleAddNew} className="bg-white text-primary hover:bg-indigo-50 font-black rounded-xl h-12 px-8 shadow-xl shadow-black/20 uppercase tracking-widest text-[10px]"><PlusCircle className="mr-2 h-4 w-4" /> Add Session Slot</Button>}
          </div>
      </div>

      {isIndexError && <Alert variant="destructive" className="glass-card bg-destructive/10 border-destructive/20"><AlertCircle className="h-4 w-4" /><AlertTitle className="font-black uppercase tracking-tight text-xs">Database Index Required</AlertTitle><AlertDescription className="text-xs">Check browser console (F12) to authorize search index for <code>timetables</code> group.</AlertDescription></Alert>}
      
      <Card className="glass-card border-none overflow-hidden p-0 shadow-2xl">
            {isLoading ? <Skeleton className="h-[600px] w-full" /> : (
            <div className="grid relative overflow-x-auto" style={{ gridTemplateColumns: '5rem repeat(5, 1fr)', gridTemplateRows: `3rem repeat(${(END_HOUR - START_HOUR) * 2}, 3.5rem)` }}>
                <div className="bg-slate-50/80 border-b border-r" />
                {daysOfWeek.map((day, i) => ( <div key={day} style={{ gridColumn: i + 2 }} className="bg-slate-50/80 text-center font-black uppercase text-[10px] tracking-[0.2em] py-4 border-b border-r last:border-r-0 text-muted-foreground">{day}</div> ))}
                {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => {
                    const hour = START_HOUR + Math.floor(i / 2); const isHour = (i % 2) === 0;
                    return (
                        <React.Fragment key={i}>
                            <div style={{ gridRow: i + 2 }} className={cn("text-right pr-4 bg-slate-50/40 border-r", isHour ? 'text-[10px] font-black uppercase text-muted-foreground pt-1' : '')}>{isHour && `${String(hour).padStart(2, '0')}:00`}</div>
                            <div style={{ gridRow: i + 2, gridColumn: '2 / span 5' }} className={cn("border-t border-r last:border-r-0", isHour ? "border-slate-100" : "border-slate-50 border-dashed")} />
                        </React.Fragment>
                    )
                })}
                {fullTimetable?.map((entry) => {
                    const rStart = timeToRow(entry.startTime); const rEnd = timeToRow(entry.endTime); const col = dayToCol(entry.dayOfWeek);
                    const colorIdx = (entry.courseId.charCodeAt(0) % 5) + 1;
                    return (
                        <div key={entry.id} style={{ gridRow: `${rStart} / ${rEnd}`, gridColumn: col }} className={cn("relative m-1 p-3 flex flex-col rounded-2xl border transition-all duration-300 group hover:z-20 hover:scale-[1.02] hover:shadow-xl", `bg-chart-${colorIdx}/10 border-chart-${colorIdx}/30 text-chart-${colorIdx}`)}>
                            <div className="flex justify-between items-start">
                                <p className="font-black text-xs uppercase tracking-tight leading-none truncate pr-4">{entry.course.name}</p>
                                {entry.meetingUrl && <a href={entry.meetingUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded-full hover:bg-black/5"><Video className="h-3 w-3" /></a>}
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">{entry.course.code}</p>
                            <div className="mt-auto space-y-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter"><Clock className="h-2.5 w-2.5" />{entry.startTime}-{entry.endTime}</div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter"><MapPin className="h-2.5 w-2.5" />{entry.room}</div>
                            </div>
                            {canManageTimetable && <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/40 backdrop-blur-sm rounded-lg p-0.5 border border-white/20"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(entry)}><Pencil className="h-3 w-3"/></Button><Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => handleDelete(entry)}><Trash2 className="h-3 w-3"/></Button></div>}
                        </div>
                    )
                })}
            </div>
            )}
        </Card>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogContent className="rounded-[2.5rem] max-w-xl">
                <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">{editingSlot ? 'Edit Session' : 'Allocate New Session'}</DialogTitle><DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Define temporal and physical allocation for class sessions.</DialogDescription></DialogHeader>
                {(areFacultyCoursesLoading || areFacultyUsersLoading) ? <Skeleton className="h-96 w-full rounded-3xl" /> : (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onTimetableSubmit)} className="space-y-6 pt-4">
                        <FormField control={form.control} name="courseId" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Module</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingSlot}>
                                    <FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        {coursesAvailableForAllocation?.map(c => <SelectItem key={c.id} value={c.id} className="rounded-lg py-2 font-bold">{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem> 
                        )} />
                        {isAdmin && ( <FormField control={form.control} name="facultyId" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Faculty</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select faculty" /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{allFaculty?.map(f => <SelectItem key={f.id} value={f.id} className="rounded-lg py-2 font-bold">{f.name}</SelectItem>)}</SelectContent></Select></FormItem> )} /> )}
                        <FormField control={form.control} name="dayOfWeek" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operational Day</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select day" /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{daysOfWeek.map(d => <SelectItem key={d} value={d} className="rounded-lg py-2 font-bold">{d}</SelectItem>)}</SelectContent></Select></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="startTime" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start (HH:MM)</FormLabel><FormControl><Input placeholder="09:00" {...field} className="glass-input" /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="endTime" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">End (HH:MM)</FormLabel><FormControl><Input placeholder="10:30" {...field} className="glass-input" /></FormControl></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="room" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Physical Venue</FormLabel><FormControl><Input placeholder="A-101" {...field} className="glass-input" /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="meetingUrl" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Online Gateway (Optional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} className="glass-input" /></FormControl></FormItem> )} />
                        <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose><Button type="submit" className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Finalize Allocation</Button></DialogFooter>
                    </form>
                </Form>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}