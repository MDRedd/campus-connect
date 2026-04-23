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
    if (!userProfile?.role) return false;
    const role = userProfile.role.toLowerCase();
    return role.includes('admin');
  }, [userProfile]);

  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return collection(firestore, 'courses');
  }, [firestore, isAdmin]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);

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

    // Generate reference and ID first for non-blocking QR code generation
    const sessionRef = doc(collection(firestore, 'attendanceSessions'));
    const sessionId = sessionRef.id;

    const sessionData = {
      id: sessionId,
      courseId: courseId,
      facultyId: authUser.uid,
      createdAt: serverTimestamp(),
      attendees: [],
    };
    
    // Non-blocking write
    setDocumentNonBlocking(sessionRef, sessionData, {});
    
    // Instantly set active session for QR generation
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
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Database Index Required</AlertTitle>
              <AlertDescription>
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
                <div className="space-y-2">
                  <Label htmlFor="course-select">Select Course</Label>
                  {areCoursesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select onValueChange={handleCourseSelect} disabled={!displayCourses || displayCourses.length === 0 || isGenerating}>
                      <SelectTrigger id="course-select">
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
                      <p className="text-xs text-muted-foreground mt-2">
                          {isAdmin ? "You need to add courses in the Course Catalog first." : "You haven't been assigned to any classes in the weekly timetable yet. Go to the Timetable page to add your classes."}
                      </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/50 p-8">
                {isGenerating && !activeSession ? (
                   <div className="text-center flex flex-col items-center gap-4 text-muted-foreground">
                        <Skeleton className="h-16 w-16" />
                        <p>Generating session...</p>
                    </div>
                ) : qrImageUrl ? (
                    <div className="text-center flex flex-col items-center gap-4">
                        <div className="bg-white p-2 rounded-lg shadow-sm border">
                            <Image
                                src={qrImageUrl}
                                alt="Attendance QR Code"
                                width={250}
                                height={250}
                                key={qrImageUrl}
                            />
                        </div>
                         <div className="w-full max-w-[250px] space-y-2">
                            <Progress value={(countdown / 60) * 100} className="h-2" />
                            <p className="text-sm font-medium text-muted-foreground">
                                {countdown > 0 ? `Code refreshes in ${countdown}s` : 'Refreshing...'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center flex flex-col items-center gap-4 text-muted-foreground">
                        <QrCode className="h-16 w-16" />
                        <p>Select a course to display the QR code</p>
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
                <div className="text-2xl font-bold">
                    {isSessionLoading ? <Skeleton className="h-8 w-12" /> : attendeeIds?.length ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  students have checked in for this session.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-4 h-80 overflow-y-auto p-4">
                 {isSessionLoading || areAttendeesLoading ? (
                    <div className="w-full space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : attendees && attendees.length > 0 ? (
                    attendees.map(attendee => (
                        <div key={attendee.id} className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8 text-xs">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={attendee.name} data-ai-hint="person portrait" />}
                                <AvatarFallback>{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{attendee.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{attendee.email}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex w-full items-center justify-center text-sm text-center text-muted-foreground">
                        <p>Waiting for students to check in...</p>
                    </div>
                )}
              </CardFooter>
            </Card>
      </div>
    </div>
  );
}
