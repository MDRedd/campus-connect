'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, query, collectionGroup, where, getDocs, DocumentData, orderBy } from 'firebase/firestore';
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, FileText, Users, Sparkles, Lightbulb } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { summarizeCourseMaterials } from '@/ai/flows/summarize-course-materials';
import { generateStudyQuestions } from '@/ai/flows/generate-study-questions';
import GradeDistributionChart from '../../dashboard/components/grade-distribution-chart';

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

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryTitle, setSummaryTitle] = useState('');
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questions, setQuestions] = useState('');
  const [questionsTitle, setQuestionsTitle] = useState('');
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);

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

        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: `results collection group for course ${courseId}`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
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
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: `enrollments collection group for course ${courseId}`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
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

  const isDataLoading = areAssignmentsLoading || areMaterialsLoading || (userProfile?.role !== 'student' && (areStudentsLoading || isPerformanceLoading));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        {isCourseLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-32" />
            </div>
        ) : course ? (
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
                <p className="text-muted-foreground">{course.code}</p>
            </div>
        ) : (
            <h1 className="text-3xl font-bold tracking-tight">Course Not Found</h1>
        )}
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {isCourseLoading ? (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-48" />
            </CardContent>
        </Card>
      ) : course ? (
        <Tabs defaultValue="assignments" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="materials">Study Materials</TabsTrigger>
                {userProfile?.role !== 'student' && <TabsTrigger value="students">Students</TabsTrigger>}
                {userProfile?.role !== 'student' && <TabsTrigger value="performance">Performance</TabsTrigger>}
            </TabsList>
            <TabsContent value="assignments" className="mt-6">
                <Card>
                    <CardHeader><CardTitle>Assignments</CardTitle><CardDescription>All assignments for {course.name}.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? (
                            <Skeleton className="h-32 w-full" />
                        ) : assignments && assignments.length > 0 ? (
                            assignments.map(assignment => (
                                <Card key={assignment.id}>
                                    <CardHeader><CardTitle className="text-lg">{assignment.title}</CardTitle></CardHeader>
                                    <CardContent><p className="text-sm text-muted-foreground">{assignment.description}</p></CardContent>
                                    <CardFooter className="flex justify-between items-center">
                                        <p className="text-sm font-medium">Deadline: {format(new Date(assignment.deadline), 'PPP')}</p>
                                        <Button variant="secondary" size="sm" asChild>
                                            <Link href={`/academics/assignment/${assignment.id}?courseId=${assignment.courseId}`}>View Details</Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                <FileText className="h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">No Assignments</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Assignments for this course will appear here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="materials" className="mt-6">
                <Card>
                    <CardHeader><CardTitle>Study Materials</CardTitle><CardDescription>All study materials for {course.name}.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {isDataLoading ? (
                            <Skeleton className="h-20 w-full" />
                        ) : materials && materials.length > 0 ? (
                            materials.map(material => (
                                <Card key={material.id} className="flex items-center justify-between p-4">
                                    <div className="flex-1">
                                        <h4 className="font-semibold">{material.title}</h4>
                                        <p className="text-sm text-muted-foreground">{material.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => handleSummarize(material)} disabled={isSummarizing}><Sparkles className="mr-2 h-4 w-4" />Summarize</Button>
                                        <Button variant="secondary" size="sm" onClick={() => handleGenerateQuestions(material)} disabled={isGeneratingQuestions}><Lightbulb className="mr-2 h-4 w-4" />Questions</Button>
                                        <Button variant="outline" size="sm" asChild><a href={material.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>
                                    </div>
                                </Card>
                            ))
                        ) : (
                             <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                <Download className="h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">No Materials</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Study materials for this course will appear here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
             {userProfile?.role !== 'student' && (
                <TabsContent value="students" className="mt-6">
                    <Card>
                        <CardHeader><CardTitle>Enrolled Students</CardTitle><CardDescription>Students enrolled in {course.name}.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            {isDataLoading ? (
                                 <Skeleton className="h-48 w-full" />
                            ) : enrolledStudents && enrolledStudents.length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {enrolledStudents.map(student => (
                                    <div key={student.id} className="flex items-center gap-4 rounded-lg border p-3">
                                        <Avatar className="h-10 w-10">
                                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={student.name} data-ai-hint="person portrait" />}
                                            <AvatarFallback>{student.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">{student.email}</p>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                                    <Users className="h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No Students Enrolled</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">No students are currently enrolled in this course.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
             )}
             {userProfile?.role !== 'student' && (
                <TabsContent value="performance" className="mt-6">
                    {isPerformanceLoading ? <Skeleton className="h-96 w-full"/> : performanceData && (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <GradeDistributionChart data={performanceData.gradeCounts} />
                            <Card>
                                <CardHeader>
                                    <CardTitle>Student Grades</CardTitle>
                                    <CardDescription>Individual student marks and grades for this course.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student</TableHead>
                                                <TableHead>Marks</TableHead>
                                                <TableHead>Grade</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {performanceData.studentResults.map((res: any) => (
                                                <TableRow key={res.studentId}>
                                                    <TableCell>{res.studentName}</TableCell>
                                                    <TableCell>{res.marks}</TableCell>
                                                    <TableCell className="font-bold">{res.grade}</TableCell>
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
      ) : (
         <Card>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">The course you are looking for does not exist or you do not have permission to view it.</p>
            </CardContent>
        </Card>
      )}

    <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
            <DialogTitle>Summary for &quot;{summaryTitle}&quot;</DialogTitle>
            <DialogDescription>This summary was generated by AI. It may not be perfect, so please use it as a guide.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isSummarizing ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Generating summary...</span>
                </div>
            ) : (
                <p className="text-sm whitespace-pre-wrap">{summary}</p>
            )}
            </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
            <DialogTitle>Study Questions for &quot;{questionsTitle}&quot;</DialogTitle>
            <DialogDescription>These questions were generated by AI to help you study. Use them as a starting point.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {isGeneratingQuestions ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Lightbulb className="h-4 w-4 animate-spin" />
                    <span>Generating questions...</span>
                </div>
            ) : (
                <p className="text-sm whitespace-pre-wrap">{questions}</p>
            )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
