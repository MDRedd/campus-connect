'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
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
import { QrCode, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import { Progress } from '@/components/ui/progress';

type Course = { id: string; name: string; code: string; };
type AttendanceSession = { courseId: string; facultyId: string; createdAt: any; attendees: string[]; id: string };
type UserProfile = { id: string; name: string; email: string; };


export default function MarkAttendancePage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const { facultyCourses, isLoading: areCoursesLoading } = useFacultyCourses();
  
  const handleCourseSelect = useCallback(async (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveSession(null);
    setIsGenerating(true);
    if (!firestore || !authUser) {
        setIsGenerating(false);
        return;
    }

    const sessionData = {
      courseId: courseId,
      facultyId: authUser.uid,
      createdAt: serverTimestamp(),
      attendees: [],
    };
    
    try {
        const sessionDocRef = await addDocumentNonBlocking(collection(firestore, 'attendanceSessions'), sessionData);
        if (sessionDocRef) {
            setActiveSession({ ...sessionData, id: sessionDocRef.id, createdAt: new Date() });
        }
    } catch(error) {
        console.error("Error creating attendance session:", error);
        // The non-blocking function will emit a global error, but we can also log here if needed.
    } finally {
        setIsGenerating(false);
    }
  }, [firestore, authUser]);

  // Effect for countdown timer and QR code refresh
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeSession && selectedCourseId) {
        setCountdown(60);
        timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleCourseSelect(selectedCourseId);
                    return 0; // Returning 0, will be reset to 60 on next session
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
    // Firestore 'in' query is limited to 30 items. For larger classes, another approach is needed.
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

  const isLoading = isAuthUserLoading || areCoursesLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Generate a QR code for students to scan and monitor live attendance.</p>
      </div>

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
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select onValueChange={handleCourseSelect} disabled={!facultyCourses || facultyCourses.length === 0 || isGenerating}>
                      <SelectTrigger id="course-select">
                        <SelectValue placeholder={facultyCourses && facultyCourses.length > 0 ? "Select a course..." : "No courses assigned"} />
                      </SelectTrigger>
                      <SelectContent>
                        {facultyCourses?.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name} ({course.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        <Image
                            src={qrImageUrl}
                            alt="Attendance QR Code"
                            width={250}
                            height={250}
                            key={qrImageUrl}
                        />
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
                    {isSessionLoading ? <Skeleton className="h-8 w-12" /> : attendees?.length ?? 0}
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
                        <div key={attendee.id} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 text-xs">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={attendee.name} data-ai-hint="person portrait" />}
                                <AvatarFallback>{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-medium">{attendee.name}</p>
                                <p className="text-xs text-muted-foreground">{attendee.email}</p>
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
