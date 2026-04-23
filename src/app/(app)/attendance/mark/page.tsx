'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, query, where } from 'firebase/firestore';
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
import { QrCode, Users, AlertCircle } from 'lucide-react';
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

  // If Admin: fetch all courses directly to avoid indexing issues on faculty assignments
  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'courses');
  }, [firestore, isAdmin]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

  // If Faculty: fetch assigned courses
  const { facultyCourses, isLoading: areFacultyCoursesLoading, error: facultyCoursesError } = useFacultyCourses();
  
  const displayCourses = useMemo(() => {
    if (isAdmin) return allCourses;
    return facultyCourses;
  }, [isAdmin, allCourses, facultyCourses]);

  const areCoursesLoading = isAuthUserLoading || (isAdmin ? areAllCoursesLoading : areFacultyCoursesLoading);
  const isIndexError = !isAdmin && (facultyCoursesError?.code === 'failed-precondition' || facultyCoursesError?.message?.toLowerCase().includes('index'));

  const handleCourseSelect = useCallback(async (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveSession(null);
    setIsGenerating(true);
    
    if (!firestore || !authUser) {
        setIsGenerating(false);
        return;
    }

    // Generate a unique ID for the session immediately on client
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Generate a QR code for students to scan and monitor live attendance.</p>
      </div>

      {isIndexError && (
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 shadow-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Database Index Required</AlertTitle>
              <AlertDescription className="text-sm">
                  Cannot load assigned courses because a Firestore index is missing. Please <strong>check the browser console (F12)</strong> and click the link to create the required index for the <code>timetables</code> collection group.
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Generate Attendance QR Code</CardTitle>
              <CardDescription>Select a course to generate a unique QR code. The code will automatically refresh every 60 seconds.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="course-select" className="text-base">Select Course</Label>
                  {areCoursesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select onValueChange={handleCourseSelect} disabled={!displayCourses || displayCourses.length === 0 || isGenerating}>
                      <SelectTrigger id="course-select" className="w-full">
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
                      <p className="text-xs text-muted-foreground mt-2 border-l-2 border-primary/20 pl-2 py-1 bg-primary/5 rounded-r-md">
                          {isAdmin ? "You need to add courses in the Course Catalog first." : "You haven't been assigned to any classes in the weekly timetable yet. Go to the Timetable page to add your classes."}
                      </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 p-8 min-h-[300px]">
                {isGenerating && !activeSession ? (
                   <div className="text-center flex flex-col items-center gap-4 text-muted-foreground">
                        <Skeleton className="h-16 w-16" />
                        <p className="animate-pulse">Generating session...</p>
                    </div>
                ) : qrImageUrl ? (
                    <div className="text-center flex flex-col items-center gap-6">
                        <div className="bg-white p-3 rounded-2xl shadow-md border border-border">
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
                            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <span>Refreshing...</span>
                                <span>{countdown}s</span>
                            </div>
                            <Progress value={(countdown / 60) * 100} className="h-2" />
                        </div>
                    </div>
                ) : (
                    <div className="text-center flex flex-col items-center gap-4 text-muted-foreground">
                        <div className="bg-muted p-6 rounded-full">
                            <QrCode className="h-12 w-12" />
                        </div>
                        <p className="max-w-[200px] text-sm font-medium">Select a course from the menu to display the QR code</p>
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Live Attendance</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                    {isSessionLoading ? <Skeleton className="h-10 w-16" /> : attendeeIds?.length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  students have checked in for this session.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-4 h-[340px] overflow-y-auto p-4 border-t">
                 {isSessionLoading || areAttendeesLoading ? (
                    <div className="w-full space-y-3">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                    </div>
                ) : attendees && attendees.length > 0 ? (
                    <div className="w-full space-y-3">
                    {attendees.map(attendee => (
                        <div key={attendee.id} className="flex items-center gap-3 w-full p-2 hover:bg-muted/50 rounded-lg transition-colors border border-transparent hover:border-border">
                            <Avatar className="h-10 w-10 text-xs border shadow-sm">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={attendee.name} data-ai-hint="person portrait" />}
                                <AvatarFallback className="bg-primary/10 text-primary">{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{attendee.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tight">{attendee.email}</p>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : (
                    <div className="flex-1 flex w-full flex-col items-center justify-center text-sm text-center text-muted-foreground gap-3">
                        <Users className="h-8 w-8 opacity-20" />
                        <p>Waiting for students...</p>
                    </div>
                )}
              </CardFooter>
            </Card>
      </div>
    </div>
  );
}
