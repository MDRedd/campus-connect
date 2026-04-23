'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, query, where, getDocs } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, Users, AlertCircle, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Course = { id: string; name: string; code: string; };
type AttendanceSession = { courseId: string; facultyId: string; createdAt: any; attendees: string[]; id: string };
type UserProfile = { id: string; name: string; email: string; };

export default function MarkAttendancePage() {
  const { user: authUser, profile: userProfile, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const isAdmin = useMemo(() => {
    const role = userProfile?.role?.toLowerCase() || '';
    return role.includes('admin');
  }, [userProfile]);

  const { facultyCourses, isLoading: areFacultyCoursesLoading, error: facultyCoursesError } = useFacultyCourses();
  
  const [allCourses, setAllCourses] = useState<Course[] | null>(null);
  const [areAllCoursesLoading, setAreAllCoursesLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const fetchAll = async () => {
        setAreAllCoursesLoading(true);
        try {
            const snap = await getDocs(collection(firestore, 'courses'));
            setAllCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        } finally {
            setAreAllCoursesLoading(false);
        }
    };
    fetchAll();
  }, [firestore, isAdmin]);

  const displayCourses = useMemo(() => {
    if (isAdmin) return allCourses;
    return facultyCourses;
  }, [isAdmin, allCourses, facultyCourses]);

  const areCoursesLoading = isAuthUserLoading || areFacultyCoursesLoading || areAllCoursesLoading;
  const isIndexError = !isAdmin && (facultyCoursesError?.code === 'failed-precondition' || facultyCoursesError?.message?.toLowerCase().includes('index'));

  const handleCourseSelect = useCallback(async (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveSession(null);
    setIsGenerating(true);
    
    if (!firestore || !authUser) {
        setIsGenerating(false);
        return;
    }

    const sessionRef = doc(collection(firestore, 'attendanceSessions'));
    const sessionId = sessionRef.id;

    const sessionData = {
      id: sessionId,
      courseId: courseId,
      facultyId: authUser.uid,
      createdAt: serverTimestamp(),
      attendees: [],
    };
    
    setDocumentNonBlocking(sessionRef, sessionData, {});
    setActiveSession({ ...sessionData, createdAt: new Date() } as AttendanceSession);
    setIsGenerating(false);
  }, [firestore, authUser]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeSession && selectedCourseId) {
        setCountdown(60);
        timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleCourseSelect(selectedCourseId);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => {
        if(timer) clearInterval(timer);
    }
  }, [activeSession, selectedCourseId, handleCourseSelect]);

  const sessionDocRef = useMemoFirebase(() => {
    if (!firestore || !activeSession) return null;
    return doc(firestore, 'attendanceSessions', activeSession.id);
  }, [firestore, activeSession]);
  const { data: sessionData, isLoading: isSessionLoading } = useDoc<AttendanceSession>(sessionDocRef);

  const attendeeIds = useMemo(() => sessionData?.attendees || [], [sessionData]);

  const attendeesQuery = useMemoFirebase(() => {
    if (!firestore || attendeeIds.length === 0) return null;
    return query(collection(firestore, 'users'), where('id', 'in', attendeeIds.slice(0, 30)));
  }, [firestore, attendeeIds]);
  const { data: attendees, isLoading: areAttendeesLoading } = useCollection<UserProfile>(attendeesQuery);

  const qrData = activeSession && selectedCourseId && authUser ? JSON.stringify({
    sessionId: activeSession.id,
    courseId: selectedCourseId,
    facultyId: authUser.uid,
    timestamp: Date.now(),
  }) : null;

  const qrImageUrl = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}` : null;

  const placeholderText = useMemo(() => {
    if (areCoursesLoading) return "Loading courses...";
    if (displayCourses && displayCourses.length > 0) return "Select a course...";
    if (isAdmin) return "No courses found in system";
    return "No courses assigned to you";
  }, [areCoursesLoading, displayCourses, isAdmin]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
            <p className="text-muted-foreground italic">Generate unique dynamic QR codes for secure check-ins.</p>
        </div>
        {isAdmin && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20"><Sparkles className="mr-1 h-3 w-3" /> System Admin Overlook</Badge>}
      </div>

      {isIndexError && (
          <Alert variant="destructive" className="glass-card bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Database Index Required</AlertTitle>
              <AlertDescription className="text-sm">
                  Cannot load assigned courses because a Firestore index is missing. Please <strong>check the browser console (F12)</strong> and click the link provided by Firebase to authorize search index for the <code>timetables</code> collection group.
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-2xl border-0 bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Attendance Configuration</CardTitle>
              <CardDescription>The QR code refreshes every 60 seconds to prevent unauthorized sharing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="course-select" className="text-base font-semibold">Step 1: Choose Course</Label>
                  {areCoursesLoading ? (
                    <Skeleton className="h-12 w-full rounded-xl" />
                  ) : (
                    <Select onValueChange={handleCourseSelect} disabled={!displayCourses || displayCourses.length === 0 || isGenerating}>
                      <SelectTrigger id="course-select" className="h-12 rounded-xl bg-white">
                        <SelectValue placeholder={placeholderText} />
                      </SelectTrigger>
                      <SelectContent>
                        {displayCourses?.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name} ({course.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!areCoursesLoading && (!displayCourses || displayCourses.length === 0) && (
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                          <p className="text-sm font-medium text-primary">No Courses Available</p>
                          <p className="text-xs text-muted-foreground">
                              {isAdmin ? "You need to add courses in the Course Catalog first." : "You haven't been assigned to any classes in the weekly timetable yet. Ask an admin or go to the Timetable page to assign yourself."}
                          </p>
                      </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-slate-50 p-8 min-h-[350px]">
                {isGenerating && !activeSession ? (
                   <div className="text-center flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium animate-pulse">Initializing Session...</p>
                    </div>
                ) : qrImageUrl ? (
                    <div className="text-center flex flex-col items-center gap-6 w-full">
                        <div className="bg-white p-6 rounded-3xl shadow-2xl ring-1 ring-slate-200">
                            <Image
                                src={qrImageUrl}
                                alt="Attendance QR Code"
                                width={250}
                                height={250}
                                key={qrImageUrl}
                                className="rounded-lg"
                            />
                        </div>
                         <div className="w-full max-w-[250px] space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>Session Security</span>
                                <span>{countdown}s</span>
                            </div>
                            <Progress value={(countdown / 60) * 100} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground italic">Students must scan this code using their Campus Connect app.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center flex flex-col items-center gap-4 text-slate-300">
                        <div className="bg-slate-100 p-8 rounded-full">
                            <QrCode className="h-16 w-16" />
                        </div>
                        <p className="max-w-[200px] text-sm font-bold text-slate-400 uppercase tracking-tighter">Waiting for course selection</p>
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-2xl border-0 bg-white/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Roster</CardTitle>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black tracking-tighter">
                    {isSessionLoading ? <Skeleton className="h-10 w-16" /> : attendeeIds?.length ?? 0}
                </div>
                <p className="text-xs font-semibold text-muted-foreground mt-1">Checked-in students</p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-4 h-[380px] overflow-y-auto p-4 border-t border-slate-100">
                 {isSessionLoading || areAttendeesLoading ? (
                    <div className="w-full space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                    </div>
                ) : attendees && attendees.length > 0 ? (
                    <div className="w-full space-y-3">
                    {attendees.map(attendee => (
                        <div key={attendee.id} className="flex items-center gap-3 w-full p-3 bg-white rounded-xl shadow-sm border border-slate-100 animate-in slide-in-from-bottom-2">
                            <Avatar className="h-10 w-10 border-2 border-primary/10">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={attendee.name} />}
                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{attendee.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate uppercase font-black">{attendee.email.split('@')[0]}</p>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : (
                    <div className="flex-1 flex w-full flex-col items-center justify-center text-sm text-center text-slate-300 gap-4">
                        <Users className="h-12 w-12 opacity-10" />
                        <p className="font-bold uppercase tracking-tighter text-slate-300">No attendees yet</p>
                    </div>
                )}
              </CardFooter>
            </Card>
      </div>
    </div>
  );
}