'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { CameraOff, CheckCircle } from 'lucide-react';

// Define the shape of the data encoded in the QR code
type QRAttendanceData = {
  sessionId: string;
  courseId: string;
  facultyId: string;
  timestamp: number;
};

export default function ScanAttendancePage() {
  const router = useRouter();
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to request camera access
  useEffect(() => {
    const getCameraPermission = async () => {
      if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
        setError('Camera access is not supported by this browser.');
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Error accessing camera:', err);
        setHasCameraPermission(false);
        let message = 'Camera access denied. Please enable camera permissions for this site in your browser settings.';
        if (window.location.protocol !== 'https:') {
            message += ' Also, camera access requires a secure connection (HTTPS).';
        }
        setError(message);
      }
    };
    getCameraPermission();

    // Cleanup: stop video stream when component unmounts
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, []);

  // Effect to handle QR code scanning
  useEffect(() => {
    if (!hasCameraPermission || !videoRef.current || scanned) return;

    if (!('BarcodeDetector' in window)) {
      setError('QR code scanning is not supported by this browser.');
      return;
    }

    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    let intervalId: NodeJS.Timeout;

    const detectCode = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return; // Wait for video to be ready
      try {
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0 && !isSubmitting) {
          setScanned(true); // Stop scanning once a code is found
          handleQrCode(barcodes[0].rawValue);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Barcode detection failed:', err);
        // Don't set a user-facing error for this, as it can happen intermittently
      }
    };

    intervalId = setInterval(detectCode, 1000); // Scan every second

    return () => clearInterval(intervalId);

  }, [hasCameraPermission, scanned, isSubmitting]);

  const handleQrCode = async (data: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const parsedData: QRAttendanceData = JSON.parse(data);
      const { sessionId, courseId, facultyId, timestamp } = parsedData;

      if (!sessionId || !courseId || !facultyId || !timestamp) {
        throw new Error('Invalid QR code data.');
      }

      // Check if QR code is recent (e.g., within 60 seconds)
      const now = Date.now();
      if (now - timestamp > 60000) {
        throw new Error('This QR code has expired. Please ask for a new one.');
      }

      if (!firestore || !authUser) {
        throw new Error('Authentication or database service is not available.');
      }
      
      // 1. Update the shared attendance session document
      const sessionRef = doc(firestore, 'attendanceSessions', sessionId);
      // This is a non-blocking update. We optimistically assume it works.
      updateDoc(sessionRef, {
        attendees: arrayUnion(authUser.uid)
      }).catch(err => {
        console.error("Failed to update attendance session:", err);
        // This error is not shown to the user to keep the UI optimistic.
      });

      // 2. Add the attendance record to the student's personal log (non-blocking)
      const attendanceColRef = collection(firestore, 'users', authUser.uid, 'attendance');
      addDocumentNonBlocking(attendanceColRef, {
        courseId,
        markedBy: facultyId,
        status: 'present',
        date: serverTimestamp(),
      });

      toast({
        title: 'Attendance Marked!',
        description: 'Your attendance has been successfully recorded.',
      });

      // Redirect after a short delay to show the success message
      setTimeout(() => router.push('/attendance'), 2000);

    } catch (e: any) {
      console.error('Error processing QR code:', e);
      setError(e.message || 'Failed to process QR code. Please try again.');
      setScanned(false); // Allow rescanning
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col gap-6 items-center">
        <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight">Scan Attendance QR</h1>
            <p className="text-muted-foreground">Point your camera at the QR code presented by your faculty.</p>
        </div>
        <Card className="w-full max-w-2xl">
            <CardContent className="p-0 overflow-hidden">
                <div className="relative aspect-video bg-black flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    
                    {scanned && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center text-white p-4">
                            <CheckCircle className="h-16 w-16 text-green-400" />
                            <p className="mt-4 font-semibold text-lg">Attendance Marked!</p>
                            <p className="text-muted-foreground">Redirecting...</p>
                        </div>
                    )}

                    {hasCameraPermission === false && !scanned && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center text-white p-4">
                            <CameraOff className="h-16 w-16 text-muted-foreground" />
                            <p className="mt-4 font-semibold text-lg">Camera Unavailable</p>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="p-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {hasCameraPermission === false && !error && (
                     <Alert variant="destructive">
                        <CameraOff className="h-4 w-4" />
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>Please enable camera access to scan the QR code.</AlertDescription>
                    </Alert>
                )}
                 {hasCameraPermission === true && !error && !scanned &&(
                     <Alert>
                        <AlertDescription>Looking for a QR code...</AlertDescription>
                    </Alert>
                )}
            </CardFooter>
        </Card>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
    </div>
  );
}
