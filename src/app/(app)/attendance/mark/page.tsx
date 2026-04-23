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
import { QrCode, Users, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
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

    const sessionId = `session-${courseId}-${Date.now()}`;
    const sessionRef = doc(firestore, 'attendanceSessions', sessionId);

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
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black tracking-tight unique-gradient-text uppercase">MARK ATTENDANCE</h1>
            <p className="text-muted-foreground font-medium italic">Generate unique dynamic QR codes for secure institutional check-ins.</p>
        </div>
        {isAdmin && <span className="px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-sm"><ShieldCheck className="inline-block mr-1.5 h-3.5 w-3.5" /> System Master Access</span>}
      </div>

      {isIndexError && (
          <Alert variant="destructive" className="glass-card bg-destructive/5 border-destructive/20 shadow-2xl animate-in shake-in duration-500">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-black uppercase tracking-tight">Database Index Required</AlertTitle>
              <AlertDescription className="text-sm font-medium">
                  The dashboard cannot load your assigned courses because a custom Firestore index is missing. Please <strong>press F12</strong> to open your browser console and click the link provided by Firebase to authorize the <code>timetables</code> search index.
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-2 glass-card border-none overflow-hidden">
            <CardHeader className="bg-white/40 border-b border-white/30 p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tight">Session Configuration</CardTitle>
              <CardDescription className="font-medium text-slate-500">Dynamic QR tokens refresh every 60 seconds to ensure session integrity and prevent unauthorized distribution.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-12 md:grid-cols-2 p-10">
              <div className="space-y-8">
                <div className="space-y-4">
                  <Label htmlFor="course-select" className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/80">Allocation Strategy: Choose Course</Label>
                  {areCoursesLoading ? (
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  ) : (
                    <Select onValueChange={handleCourseSelect} disabled={!displayCourses || displayCourses.length === 0 || isGenerating}>
                      <SelectTrigger id="course-select" className="h-16 rounded-2xl bg-white/80 border-white/50 shadow-inner font-bold text-lg px-6">
                        <SelectValue placeholder={placeholderText} />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {displayCourses?.map(course => (
                          <SelectItem key={course.id} value={course.id} className="rounded-xl py-3 px-4">
                            <div className="flex flex-col">
                                <span className="font-bold">{course.name}</span>
                                <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{course.code}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!areCoursesLoading && (!displayCourses || displayCourses.length === 0) && (
                      <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 space-y-3 animate-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 text-indigo-600 font-black uppercase text-xs tracking-widest">
                            <AlertCircle className="h-4 w-4" /> No Active Allocations
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                              {isAdmin ? "Institutional catalog is currently empty. Please register courses in the Master Catalog first." : "Your teaching schedule is not yet synchronized. Please assign sessions in the Timetable or contact the Registrar."}
                          </p>
                      </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-indigo-200/50 bg-slate-50/30 p-10 min-h-[420px] shadow-inner relative group">
                {isGenerating && !activeSession ? (
                   <div className="text-center flex flex-col items-center gap-6">
                        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-primary"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse text-indigo-500">Initializing Secure Token...</p>
                    </div>
                ) : qrImageUrl ? (
                    <div className="text-center flex flex-col items-center gap-10 w-full animate-in zoom-in duration-500">
                        <div className="bg-white p-8 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(79,70,229,0.3)] ring-1 ring-indigo-50 group-hover:scale-[1.02] transition-transform duration-700">
                            <Image
                                src={qrImageUrl}
                                alt="Attendance QR Code"
                                width={280}
                                height={280}
                                key={qrImageUrl}
                                className="rounded-2xl"
                            />
                        </div>
                         <div className="w-full max-w-[280px] space-y-4">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <span className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"/> Encrypted Token</span>
                                <span className="text-primary">{countdown}s</span>
                            </div>
                            <Progress value={(countdown / 60) * 100} className="h-2 bg-slate-200/50" />
                            <p className="text-[10px] text-slate-400 italic font-bold leading-tight px-4 text-center">Protocol: Students must scan via verified Campus Connect app instances.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center flex flex-col items-center gap-8 text-slate-300">
                        <div className="bg-white/50 p-12 rounded-full shadow-inner border border-white">
                            <QrCode className="h-24 w-24 opacity-10" />
                        </div>
                        <div className="space-y-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Course Index</p>
                             <p className="text-[9px] font-medium text-slate-400">Selection required for session authorization</p>
                        </div>
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card border-none bg-white/50 shadow-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-8 border-b border-white/30 bg-white/20">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/70">Real-time Session Roster</CardTitle>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-green-500">Live</span>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
              </CardHeader>
              <CardContent className="p-8 pb-4">
                <div className="text-7xl font-black tracking-tighter text-indigo-900 leading-none">
                    {isSessionLoading ? <Skeleton className="h-16 w-24" /> : attendeeIds?.length ?? 0}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Verified Presence Index</p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-4 h-[440px] overflow-y-auto p-4 border-t border-white/30 bg-indigo-50/20 backdrop-blur-sm">
                 {isSessionLoading || areAttendeesLoading ? (
                    <div className="w-full space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-[1.5rem]" />)}
                    </div>
                ) : attendees && attendees.length > 0 ? (
                    <div className="w-full space-y-3 px-2">
                    {attendees.map(attendee => (
                        <div key={attendee.id} className="flex items-center gap-4 w-full p-4 bg-white/90 rounded-[1.5rem] shadow-xl shadow-indigo-500/5 border border-white animate-in slide-in-from-bottom-4 group hover:scale-[1.02] transition-all">
                            <Avatar className="h-12 w-12 border-2 border-indigo-100 shadow-inner">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={attendee.name} />}
                                <AvatarFallback className="bg-indigo-50 text-primary text-xs font-black uppercase">{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black truncate text-slate-800 uppercase tracking-tight">{attendee.name}</p>
                                <p className="text-[10px] text-slate-400 truncate uppercase font-black tracking-widest opacity-60">Roll: {attendee.email.split('@')[0]}</p>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : (
                    <div className="flex-1 flex w-full flex-col items-center justify-center text-sm text-center gap-8 py-10 opacity-30">
                        <Users className="h-20 w-20 text-indigo-200" />
                        <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.2em] text-slate-400 text-xs">Waiting for Scan Events</p>
                            <p className="text-[9px] font-bold text-slate-400 italic">Institutional check-ins will appear here</p>
                        </div>
                    </div>
                )}
              </CardFooter>
            </Card>
      </div>
    </div>
  );
}