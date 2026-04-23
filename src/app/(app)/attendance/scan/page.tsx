
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { CameraOff, CheckCircle, QrCode, Sparkles, ShieldCheck, ArrowLeft, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
        setError('Environment protocol failure: Media capture not supported.');
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
        setError('Authorization Denied: Camera access rejected by system policy.');
      }
    };
    getCameraPermission();

    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, []);

  useEffect(() => {
    if (!hasCameraPermission || !videoRef.current || scanned) return;

    if (!('BarcodeDetector' in window)) {
      // BarcodeDetector is a newer API, falling back or informing.
      // Most modern browsers/OS have native support for QR.
      return;
    }

    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    let intervalId: NodeJS.Timeout;

    const detectCode = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0 && !isSubmitting) {
          setScanned(true);
          handleQrCode(barcodes[0].rawValue);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Terminal detection error:', err);
      }
    };

    intervalId = setInterval(detectCode, 800);
    return () => clearInterval(intervalId);

  }, [hasCameraPermission, scanned, isSubmitting]);

  const handleQrCode = async (data: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const parsedData: QRAttendanceData = JSON.parse(data);
      const { sessionId, courseId, facultyId, timestamp } = parsedData;

      if (!sessionId || !courseId || !facultyId || !timestamp) {
        throw new Error('Terminal Protocol Failure: Encrypted token payload is invalid.');
      }

      const now = Date.now();
      if (now - timestamp > 60000) {
        throw new Error('Authorization Expired: QR Token has surpassed the 60s lifecycle.');
      }

      if (!firestore || !authUser) {
        throw new Error('Sync Failure: Infrastructure services unavailable.');
      }
      
      const sessionRef = doc(firestore, 'attendanceSessions', sessionId);
      updateDocumentNonBlocking(sessionRef, {
        attendees: arrayUnion(authUser.uid)
      });

      const attendanceColRef = collection(firestore, 'users', authUser.uid, 'attendance');
      addDocumentNonBlocking(attendanceColRef, {
        courseId,
        markedBy: facultyId,
        status: 'present',
        date: serverTimestamp(),
      });

      toast({
        title: 'Check-in Verified',
        description: 'Your presence index has been successfully synchronized.',
      });

      setTimeout(() => router.push('/attendance'), 2000);

    } catch (e: any) {
      console.error('Terminal Protocol Error:', e);
      setError(e.message || 'Verification Error: Failed to process secure token.');
      setScanned(false);
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col gap-8 items-center pb-20 animate-in fade-in duration-700">
        <div className="w-full max-w-2xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck className="h-3 w-3" /> Secure Check-in Node
            </div>
            <h1 className="text-4xl font-black tracking-tight uppercase leading-none">SCAN TERMINAL</h1>
            <p className="text-muted-foreground font-medium">Align your viewport with the dynamic QR token provided by faculty.</p>
        </div>

        <Card className="w-full max-w-2xl glass-card border-none overflow-hidden shadow-2xl relative group">
            <div className="absolute top-6 left-6 z-20 flex gap-2">
                 <Badge className="bg-black/40 backdrop-blur-md border-white/20 text-white font-black uppercase text-[8px] tracking-widest px-2 py-1">Node: Active</Badge>
                 <Badge className="bg-green-500/80 backdrop-blur-md border-none text-white font-black uppercase text-[8px] tracking-widest px-2 py-1 animate-pulse">Live Feed</Badge>
            </div>
            
            <CardContent className="p-0 bg-black aspect-video relative flex items-center justify-center overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover opacity-90" autoPlay muted playsInline />
                
                {/* HUD Elements */}
                <div className="absolute inset-0 pointer-events-none border-[30px] border-black/5" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/20 rounded-[2rem] flex items-center justify-center">
                     <div className="absolute inset-0 border-4 border-primary/20 rounded-[2rem] animate-pulse" />
                     <QrCode className="h-12 w-12 text-white/10" />
                </div>

                {scanned && (
                    <div className="absolute inset-0 bg-primary/80 backdrop-blur-md z-30 flex flex-col items-center justify-center text-center text-white p-8 animate-in zoom-in duration-500">
                        <div className="bg-white p-6 rounded-full shadow-2xl shadow-black/40 mb-6">
                            <CheckCircle className="h-16 w-16 text-primary" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">VERIFIED</h2>
                        <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mt-2 opacity-80">Synchronizing Identity Ledger...</p>
                    </div>
                )}

                {hasCameraPermission === false && !scanned && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-center text-white p-8">
                        <CameraOff className="h-16 w-16 text-slate-700 mb-4" />
                        <h3 className="text-xl font-black uppercase tracking-tight">Lens Obstruction</h3>
                        <p className="text-slate-500 text-sm mt-2 max-w-xs">Hardware authorization failed. Ensure permissions are enabled in system settings.</p>
                        <Button variant="outline" className="mt-8 border-white/10 text-white hover:bg-white/10" onClick={() => window.location.reload()}>
                            <RefreshCcw className="mr-2 h-4 w-4" /> Retry Authorization
                        </Button>
                    </div>
                )}
            </CardContent>
            
            <CardFooter className="p-8 bg-white/40 border-t border-white/20 flex flex-col gap-6">
                {error ? (
                    <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-2xl">
                        <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Protocol Exception</AlertTitle>
                        <AlertDescription className="font-medium">{error}</AlertDescription>
                    </Alert>
                ) : (
                    <div className="flex items-center gap-6 w-full opacity-60">
                        <div className="p-4 bg-white/50 rounded-2xl border border-white">
                             <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Security Parameters</p>
                            <p className="text-xs font-bold text-slate-700">Encrypted token handshake active. Do not refresh terminal during scan.</p>
                        </div>
                    </div>
                )}
            </CardFooter>
        </Card>
        
        <Button variant="ghost" className="rounded-xl px-10 h-12 font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-white" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Terminate Session
        </Button>
    </div>
  );
}
