'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, query, collectionGroup, where, getDocs, orderBy } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, FileText, Users, Sparkles, Lightbulb, GraduationCap, CheckCircle2, XCircle, BookOpen, Clock, BadgeCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { summarizeCourseMaterials } from '@/ai/flows/summarize-course-materials';
import { generateStudyQuestions } from '@/ai/flows/generate-study-questions';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/generate-quiz';
import GradeDistributionChart from '../../dashboard/components/grade-distribution-chart';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Course = {
  id: string;
  name: string;
  code: string;
  department: string;
  credits: number;
};
type UserProfile = { role: 'student' | 'faculty' | 'admin', name: string, id: string, email: string };
type Assignment = { id: string; title: string; description: string; deadline: string; courseId: string; };
type StudyMaterial = { id: string; title: string; description: string; fileUrl: string; };
type Result = { id: string; studentId: string; courseId: string; semester: string; year: number; marks: number; grade: string; published: boolean; };

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { profile: userProfile } = useUser();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const courseId = params.courseId as string;

  // AI Summary State
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  
  // AI Questions State
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questions, setQuestions] = useState('');
  const [questionsTitle, setQuestionsTitle] = useState('');
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);

  // AI Quiz State
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizData, setQuizData] = useState<GenerateQuizOutput['quiz'] | null>(null);
  const [quizTitle, setQuestionsQuizTitle] = useState('');
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  const assignmentsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return query(collection(firestore, 'courses', courseId, 'assignments'), orderBy('deadline', 'desc'));
  }, [firestore, courseId]);
  const { data: assignments, isLoading: areAssignmentsLoading } = useCollection<Assignment>(assignmentsQuery);

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return collection(firestore, 'courses', courseId, 'study_materials');
  }, [firestore, courseId]);
  const { data: materials, isLoading: areMaterialsLoading } = useCollection<StudyMaterial>(materialsQuery);

  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[] | null>(null);
  const [areStudentsLoading, setAreStudentsLoading] = useState(true);

  const [performanceData, setPerformanceData] = useState<{ gradeCounts: any[], studentResults: any[] } | null>(null);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !courseId || userProfile?.role === 'student') {
        setIsPerformanceLoading(false);
        return;
    }

    const fetchPerformanceData = async () => {
        setIsPerformanceLoading(true);
        try {
            const resultsQuery = query(collectionGroup(firestore, 'results'), where('courseId', '==', courseId));
            const resultsSnapshot = await getDocs(resultsQuery);
            const courseResults = resultsSnapshot.docs.map(d => ({ ...(d.data() as Result), studentId: d.ref.parent.parent!.id }));

            if (courseResults.length === 0) {
                setPerformanceData({ gradeCounts: [], studentResults: [] });
                return;
            }

            const studentIds = [...new Set(courseResults.map(r => r.studentId))];
            const studentsData: UserProfile[] = [];
            for (let i = 0; i < studentIds.length; i += 30) {
                const chunk = studentIds.slice(i, i + 30);
                const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                const studentsSnapshot = await getDocs(studentsQuery);
                studentsSnapshot.forEach(doc => studentsData.push(doc.data() as UserProfile));
            }
            const studentMap = new Map(studentsData.map(s => [s.id, s.name]));

            const gradeCounts: { [grade: string]: number } = {};
            courseResults.forEach(r => {
                gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
            });

            const gradeChartData = Object.entries(gradeCounts).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name));
            
            const studentResultsWithNames = courseResults.map(r => ({
                ...r,
                studentName: studentMap.get(r.studentId) || 'Unknown Student'
            })).sort((a,b) => b.marks - a.marks);

            setPerformanceData({ gradeCounts: gradeChartData, studentResults: studentResultsWithNames });

        } catch (error: any) {
            console.error("Error fetching performance data:", error);
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `results`,
                    operation: 'list',
                }));
            }
            setPerformanceData(null);
        } finally {
            setIsPerformanceLoading(false);
        }
    };

    fetchPerformanceData();
  }, [firestore, courseId, userProfile]);

  useEffect(() => {
    if (!firestore || !courseId || userProfile?.role === 'student') {
        setAreStudentsLoading(false);
        return;
    }

    const fetchEnrolledStudents = async () => {
        setAreStudentsLoading(true);
        try {
            const enrollmentsQuery = query(collectionGroup(firestore, 'enrollments'), where('courseId', '==', courseId));
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            const studentIds = enrollmentsSnapshot.docs.map(d => d.data().studentId as string);

            if (studentIds.length > 0) {
                const studentsData: UserProfile[] = [];
                for (let i = 0; i < studentIds.length; i += 30) {
                    const chunk = studentIds.slice(i, i + 30);
                    const studentsQuery = query(collection(firestore, 'users'), where('id', 'in', chunk));
                    const studentsSnapshot = await getDocs(studentsQuery);
                    studentsSnapshot.forEach(doc => studentsData.push(doc.data() as UserProfile));
                }
                setEnrolledStudents(studentsData);
            } else {
                setEnrolledStudents([]);
            }
        } catch (error: any) {
            console.error("Error fetching enrolled students:", error);
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `enrollments`,
                    operation: 'list',
                }));
            }
            setEnrolledStudents([]);
        } finally {
            setAreStudentsLoading(false);
        }
    }

    fetchEnrolledStudents();

  }, [firestore, courseId, userProfile]);

  const handleSummarize = async (material: StudyMaterial) => {
    if (!course) return;
    setIsSummarizing(true);
    setSummary('');
    setSummaryTitle(material.title);
    setShowSummaryDialog(true);
    try {
      const result = await summarizeCourseMaterials({
        courseName: course.name,
        material: `${material.title}\n\n${material.description}`,
      });
      setSummary(result.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuestions = async (material: StudyMaterial) => {
    setIsGeneratingQuestions(true);
    setQuestions('');
    setQuestionsTitle(material.title);
    setShowQuestionsDialog(true);
    try {
      const result = await generateStudyQuestions({
        courseMaterials: `${material.title}\n\n${material.description}`,
      });
      setQuestions(result.studyQuestions);
    } catch (error) {
      console.error('Error generating study questions:', error);
      setQuestions('Failed to generate study questions. Please try again.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleStartQuiz = async (material: StudyMaterial) => {
    if (!course) return;
    setIsGeneratingQuiz(true);
    setQuizData(null);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setSelectedOption(null);
    setQuizSubmitted(false);
    setShowExplanation(false);
    setQuestionsQuizTitle(material.title);
    setShowQuizDialog(true);

    try {
        const result = await generateQuiz({
            courseName: course.name,
            material: `${material.title}\n\n${material.description}`,
        });
        setQuizData(result.quiz);
    } catch (error) {
        console.error("Error generating quiz:", error);
    } finally {
        setIsGeneratingQuiz(false);
    }
  };

  const handleOptionSelect = (index: number) => {
      if (showExplanation) return;
      setSelectedOption(index);
  };

  const handleSubmitAnswer = () => {
      if (selectedOption === null || !quizData) return;
      
      const correct = selectedOption === quizData[currentQuizIndex].correctAnswerIndex;
      if (correct) {
          setQuizScore(prev => prev + 1);
      }
      setShowExplanation(true);
  };

  const handleNextQuestion = () => {
      if (!quizData) return;
      if (currentQuizIndex < quizData.length - 1) {
          setCurrentQuizIndex(prev => prev + 1);
          setSelectedOption(null);
          setShowExplanation(false);
      } else {
          setQuizSubmitted(true);
      }
  };

  const isDataLoading = areAssignmentsLoading || areMaterialsLoading || (userProfile?.role !== 'student' && (areStudentsLoading || isPerformanceLoading));

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Catalog
                </Button>
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                        <BookOpen className="h-3 w-3" /> Intellectual Node
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                        {isCourseLoading ? <Skeleton className="h-12 w-64" /> : course?.name}
                    </h1>
                    <p className="text-indigo-100/70 font-medium">{course?.code} • {course?.department}</p>
                </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Academic Credits</span>
                <span className="text-5xl font-black tracking-tighter">{course?.credits ?? '--'}</span>
            </div>
        </div>
      </div>

      <Tabs defaultValue="assignments" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4 h-12 p-1 bg-white/50 backdrop-blur-sm border rounded-xl">
                <TabsTrigger value="assignments" className="rounded-lg">Assignments</TabsTrigger>
                <TabsTrigger value="materials" className="rounded-lg">Study HUD</TabsTrigger>
                {userProfile?.role !== 'student' && <TabsTrigger value="students" className="rounded-lg">Enrolled</TabsTrigger>}
                {userProfile?.role !== 'student' && <TabsTrigger value="performance" className="rounded-lg">Analytics</TabsTrigger>}
            </TabsList>

            <TabsContent value="assignments" className="mt-8">
                <Card className="glass-card border-none">
                    <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Curriculum Milestones</CardTitle><CardDescription className="text-xs font-medium">Core assessments required for module certification.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : assignments && assignments.length > 0 ? (
                            assignments.map(assignment => (
                                <Card key={assignment.id} className="border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-2xl group overflow-hidden">
                                    <CardHeader className="flex flex-row items-center gap-4">
                                        <div className="bg-primary/5 text-primary p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all"><FileText className="h-6 w-6" /></div>
                                        <div className="flex-1">
                                            <CardTitle className="text-lg font-black uppercase tracking-tight truncate">{assignment.title}</CardTitle>
                                            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1 flex items-center gap-2">
                                                <Clock className="h-3 w-3" /> Deadline: {format(new Date(assignment.deadline), 'PPP')}
                                            </CardDescription>
                                        </div>
                                        <Button asChild variant="secondary" size="sm" className="rounded-xl h-10 px-8 font-black uppercase tracking-widest text-[10px]">
                                            <Link href={`/academics/assignment/${assignment.id}?courseId=${assignment.courseId}`}>Access Work Node</Link>
                                        </Button>
                                    </CardHeader>
                                </Card>
                            ))
                        ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No active assignments indexed</div>}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="materials" className="mt-8">
                <Card className="glass-card border-none">
                    <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Intellectual Assets</CardTitle><CardDescription className="text-xs font-medium">Course materials enhanced with AI-driven learning tools.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : materials && materials.length > 0 ? (
                            materials.map(material => (
                                <Card key={material.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6 border border-indigo-50/50 bg-white/40 rounded-2xl group">
                                    <div className="flex-1 space-y-1">
                                        <h4 className="font-black text-slate-800 uppercase tracking-tight leading-none">{material.title}</h4>
                                        <p className="text-xs text-muted-foreground font-medium italic">"{material.description}"</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleSummarize(material)} disabled={isSummarizing} className="rounded-xl h-9 border-indigo-100 font-black uppercase text-[9px] tracking-widest bg-white/50"><Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />Summary</Button>
                                        <Button variant="outline" size="sm" onClick={() => handleGenerateQuestions(material)} disabled={isGeneratingQuestions} className="rounded-xl h-9 border-indigo-100 font-black uppercase text-[9px] tracking-widest bg-white/50"><Lightbulb className="mr-1.5 h-3.5 w-3.5 text-amber-500" />Questions</Button>
                                        <Button variant="outline" size="sm" onClick={() => handleStartQuiz(material)} disabled={isGeneratingQuiz} className="rounded-xl h-9 border-indigo-100 font-black uppercase text-[9px] tracking-widest bg-white/50"><BadgeCheck className="mr-1.5 h-3.5 w-3.5 text-green-500" />Quiz</Button>
                                        <Button size="sm" asChild className="rounded-xl h-9 px-6 font-black uppercase text-[9px] tracking-widest"><a href={material.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-1.5 h-3.5 w-3.5" />Download</a></Button>
                                    </div>
                                </Card>
                            ))
                        ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No repository assets found</div>}
                    </CardContent>
                </Card>
            </TabsContent>

             {userProfile?.role !== 'student' && (
                <TabsContent value="students" className="mt-8">
                    <Card className="glass-card border-none">
                        <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Verified Persona Roster</CardTitle><CardDescription className="text-xs font-medium">Students currently authorized for this academic node.</CardDescription></CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {isDataLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />) : enrolledStudents && enrolledStudents.length > 0 ? (
                                enrolledStudents.map(student => (
                                    <div key={student.id} className="flex items-center gap-4 rounded-2xl border border-indigo-50/50 bg-white/40 p-4 hover:bg-white transition-all group">
                                        <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={student.name} />}
                                            <AvatarFallback className="font-black text-xs uppercase bg-primary/5 text-primary">{student.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 uppercase tracking-tight truncate">{student.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{student.email.split('@')[0]}</p>
                                        </div>
                                    </div>
                                ))
                            ) : <div className="col-span-full text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">Awaiting student enrollment</div>}
                        </CardContent>
                    </Card>
                </TabsContent>
             )}

             {userProfile?.role !== 'student' && (
                <TabsContent value="performance" className="mt-8">
                    {isPerformanceLoading ? <Skeleton className="h-96 w-full rounded-3xl"/> : performanceData && (
                        <div className="grid gap-8 lg:grid-cols-12">
                            <div className="lg:col-span-5"><GradeDistributionChart data={performanceData.gradeCounts} /></div>
                            <Card className="lg:col-span-7 glass-card border-none overflow-hidden">
                                <CardHeader className="bg-white/40 border-b border-white/20"><CardTitle className="text-xl font-black uppercase tracking-tight">Performance Ledger</CardTitle><CardDescription className="text-[10px] font-black uppercase tracking-widest">Authorized student marks and grade distribution.</CardDescription></CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow>
                                                <TableHead className="pl-8 uppercase text-[9px] font-black tracking-widest">Student</TableHead>
                                                <TableHead className="uppercase text-[9px] font-black tracking-widest text-center">Marks</TableHead>
                                                <TableHead className="text-right pr-8 uppercase text-[9px] font-black tracking-widest">Grade</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {performanceData.studentResults.map((res: any) => (
                                                <TableRow key={res.studentId} className="hover:bg-indigo-50/30 group transition-colors">
                                                    <TableCell className="pl-8 font-bold text-slate-700">{res.studentName}</TableCell>
                                                    <TableCell className="text-center font-black text-primary">{res.marks}%</TableCell>
                                                    <TableCell className="text-right pr-8">
                                                        <Badge className={cn("rounded-lg font-black text-[10px] min-w-8 justify-center uppercase", res.marks >= 80 ? "bg-green-500" : "bg-primary")}>{res.grade}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>
             )}
        </Tabs>

        {/* AI Dialogs */}
        <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
            <DialogContent className="rounded-[2.5rem] max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Asset Synthesis: {summaryTitle}</DialogTitle>
                    <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">AI Intelligence Layer v1.0</DialogDescription>
                </DialogHeader>
                <div className="py-6 max-h-[60vh] overflow-y-auto">
                {isSummarizing ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <Sparkles className="h-10 w-10 text-primary animate-spin" />
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Synthesizing Core Concepts...</p>
                    </div>
                ) : <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap p-6 bg-slate-50 rounded-2xl border border-indigo-50">{summary}</p>}
                </div>
            </DialogContent>
        </Dialog>
      
        <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
            <DialogContent className="rounded-[2.5rem] max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Cognitive Drills: {questionsTitle}</DialogTitle>
                    <DialogDescription className="font-bold text-amber-500 uppercase text-[10px] tracking-widest">AI Practice Protocol</DialogDescription>
                </DialogHeader>
                <div className="py-6 max-h-[60vh] overflow-y-auto">
                {isGeneratingQuestions ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <Lightbulb className="h-10 w-10 text-amber-500 animate-pulse" />
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-500">Generating Inquisitive Nodes...</p>
                    </div>
                ) : <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap p-6 bg-slate-50 rounded-2xl border border-indigo-50">{questions}</p>}
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
            <DialogContent className="rounded-[2.5rem] max-w-2xl overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Knowledge Challenge: {quizTitle}</DialogTitle>
                    <DialogDescription className="font-bold text-green-600 uppercase text-[10px] tracking-widest">Interactive Evaluation HUD</DialogDescription>
                </DialogHeader>
                <div className="py-6 min-h-[400px] flex flex-col">
                    {isGeneratingQuiz ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                            <div className="p-8 bg-green-50 rounded-full animate-bounce"><GraduationCap className="h-12 w-12 text-green-600" /></div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-green-600">Compiling Evaluation Matrix...</p>
                        </div>
                    ) : quizSubmitted ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-10 animate-in zoom-in duration-500">
                            <div className="relative">
                                <div className="h-32 w-32 rounded-full border-8 border-green-100 flex items-center justify-center">
                                    <span className="text-4xl font-black text-green-600 tracking-tighter">{quizScore} / 5</span>
                                </div>
                                <Sparkles className="absolute -top-4 -right-4 h-8 w-8 text-amber-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black uppercase tracking-tight">Challenge Finalized</h3>
                                <p className="text-sm text-slate-500 font-medium">Performance index synchronized with session history.</p>
                            </div>
                            <Button onClick={() => setShowQuizDialog(false)} className="rounded-xl h-12 px-12 font-black uppercase tracking-widest text-[10px]">Close Node</Button>
                        </div>
                    ) : quizData ? (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-slate-100 pb-4">
                                <span>Session Progress: {currentQuizIndex + 1} / 5</span>
                                <span className="text-primary">Current Score: {quizScore}</span>
                            </div>
                            
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">"{quizData[currentQuizIndex].question}"</h3>
                                <div className="grid gap-3">
                                    {quizData[currentQuizIndex].options.map((option, idx) => {
                                        const isCorrect = idx === quizData[currentQuizIndex].correctAnswerIndex;
                                        const isSelected = selectedOption === idx;
                                        return (
                                            <button key={idx} disabled={showExplanation} onClick={() => handleOptionSelect(idx)} className={cn(
                                                "flex items-center justify-between p-5 rounded-2xl border-2 text-left transition-all text-sm font-bold uppercase tracking-tight group",
                                                isSelected && !showExplanation && "border-primary bg-primary/5 text-primary",
                                                showExplanation && isCorrect && "border-green-500 bg-green-50 text-green-700",
                                                showExplanation && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-700",
                                                !isSelected && !showExplanation && "border-transparent bg-slate-50 hover:bg-slate-100 text-slate-500"
                                            )}>
                                                <span>{option}</span>
                                                {showExplanation && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                                                {showExplanation && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {showExplanation && (
                                <div className="p-6 bg-slate-900 text-white rounded-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/60 mb-2">Evaluative Rationale</p>
                                    <p className="text-xs font-medium leading-relaxed italic">"{quizData[currentQuizIndex].explanation}"</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6">
                                {!showExplanation ? (
                                    <Button onClick={handleSubmitAnswer} disabled={selectedOption === null} className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px]">Authorize Response</Button>
                                ) : (
                                    <Button onClick={handleNextQuestion} className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px]">
                                        {currentQuizIndex === quizData.length - 1 ? 'Finalize Challenge' : 'Next Node'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
