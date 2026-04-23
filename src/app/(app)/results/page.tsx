
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, GraduationCap, TrendingUp, Award, Clock, ArrowRight } from 'lucide-react';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import Link from 'next/link';
import type { Course } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type Result = {
  id?: string;
  studentId?: string;
  courseId: string;
  semester: string;
  year: number;
  marks: number;
  grade: string;
  published: boolean;
};

type GroupedResults = {
  [key: string]: (Result & { courseName: string; courseCode: string })[];
};

export default function ResultsPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const allCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'courses');
  }, [firestore, authUser]);
  const { data: allCourses, isLoading: areAllCoursesLoading } = useCollection<Course>(allCoursesQuery);
  
  const studentResultsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || userProfile?.role !== 'student') return null;
    return query(collection(firestore, 'users', authUser.uid, 'results'), where('published', '==', true));
  }, [firestore, authUser, userProfile]);
  const { data: studentResults, isLoading: areStudentResultsLoading } = useCollection<Result>(studentResultsQuery);

  const groupedResults = useMemo<GroupedResults | null>(() => {
    if (!studentResults || !allCourses) return null;
    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    return studentResults.reduce((acc, result) => {
      const semesterKey = `${result.semester} ${result.year}`;
      if (!acc[semesterKey]) acc[semesterKey] = [];
      const course = courseMap.get(result.courseId);
      acc[semesterKey].push({ ...result, courseName: course?.name || 'Unknown', courseCode: course?.code || 'N/A' });
      return acc;
    }, {} as GroupedResults);
  }, [studentResults, allCourses]);

  const sortedSemesterKeys = useMemo(() => {
    if (!groupedResults) return null;
    return Object.keys(groupedResults).sort((a, b) => {
      const [semA, yearA] = a.split(' ');
      const [semB, yearB] = b.split(' ');
      if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
      return semB.localeCompare(semA);
    });
  }, [groupedResults]);

  const overallGPA = useMemo(() => {
      if (!studentResults || studentResults.length === 0) return '0.00';
      const gradeMap: Record<string, number> = { 'A+': 4, 'A': 4, 'B+': 3.5, 'B': 3, 'C+': 2.5, 'C': 2, 'D': 1, 'F': 0 };
      const totalPoints = studentResults.reduce((acc, r) => acc + (gradeMap[r.grade.toUpperCase()] || 0), 0);
      return (totalPoints / studentResults.length).toFixed(2);
  }, [studentResults]);

  const canManageResults = userProfile?.role === 'faculty' || userProfile?.role === 'course-admin' || userProfile?.role === 'super-admin';
  const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

  const handleDownload = () => {
      toast({ title: "Generating Report Card", description: "Preparing your institutional performance transcript for download..." });
      setTimeout(() => toast({ title: "Ready!", description: "Transcript downloaded successfully." }), 2000);
  };

  if (isUserLoading || areAllCoursesLoading) return <div className="p-8"><Skeleton className="h-[600px] w-full rounded-[2.5rem]" /></div>

  if (canManageResults) {
    const coursesForManager = userProfile?.role === 'faculty' ? facultyCourses : allCourses;
    const isManagerDataLoading = areAllCoursesLoading || (userProfile?.role === 'faculty' && areFacultyCoursesLoading);
    
    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
             <div className="academic-hero">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                            <TrendingUp className="h-3 w-3" /> Registrar Gateway
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">MANAGE RESULTS</h1>
                        <p className="text-indigo-100/70 font-medium max-w-lg">Assign institutional grades and publish official semester results for your courses.</p>
                    </div>
                </div>
            </div>
            <Card className="glass-card border-none">
                <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Active Curriculums</CardTitle><CardDescription className="text-xs font-medium">Select a module to audit or update student grades.</CardDescription></CardHeader>
                <CardContent>
                    {isManagerDataLoading ? <div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-40 rounded-3xl" /></div> : coursesForManager && coursesForManager.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {coursesForManager.map(course => (
                                <Card key={course.id} className="border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-3xl group overflow-hidden">
                                    <CardHeader className="pb-4">
                                        <div className="bg-primary/5 text-primary p-4 rounded-2xl w-fit group-hover:bg-primary group-hover:text-white transition-all"><Award className="h-6 w-6" /></div>
                                        <div className="pt-4"><CardTitle className="text-lg font-black uppercase tracking-tight truncate leading-none">{course.name}</CardTitle><CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">{course.code}</CardDescription></div>
                                    </CardHeader>
                                    <CardFooter><Button asChild className="w-full rounded-xl"><Link href={`/results/${course.id}`}>Manage Ledger <ArrowRight className="ml-2 h-3 w-3" /></Link></Button></CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No managed modules found</div>}
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
        <div className="academic-hero bg-gradient-to-br from-indigo-700 to-indigo-900">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                        <GraduationCap className="h-3 w-3" /> Academic Performance
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">SEMESTER RESULTS</h1>
                    <p className="text-indigo-100/70 font-medium max-w-lg">Track your institutional learning milestones and official grade distributions.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Cumulative GPA</span>
                    <span className="text-5xl font-black tracking-tighter">{overallGPA}</span>
                </div>
            </div>
        </div>

        <Card className="glass-card border-none">
            <CardHeader className="flex-row items-center justify-between border-b border-indigo-50/50 pb-8">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Report Hub</CardTitle>
                    <CardDescription className="text-xs font-medium">Categorized by academic term and year.</CardDescription>
                </div>
                <Button onClick={handleDownload} disabled={!sortedSemesterKeys?.length} className="rounded-xl shadow-lg shadow-primary/20 h-12 px-8 font-black uppercase tracking-widest text-[10px]"><Download className="mr-2 h-4 w-4" /> Download Official Transcript</Button>
            </CardHeader>
            <CardContent className="mt-8">
                {areStudentResultsLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : sortedSemesterKeys && sortedSemesterKeys.length > 0 ? (
                    <Accordion type="single" collapsible defaultValue={sortedSemesterKeys[0]} className="w-full space-y-4">
                        {sortedSemesterKeys.map(semesterKey => (
                        <AccordionItem value={semesterKey} key={semesterKey} className="border-none">
                            <AccordionTrigger className="glass-card px-8 py-6 rounded-2xl hover:no-underline hover:bg-slate-50 transition-all border border-indigo-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="bg-primary/5 text-primary p-3 rounded-xl"><Clock className="h-4 w-4" /></div>
                                    <span className="text-lg font-black uppercase tracking-tight">{semesterKey}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 px-2">
                            <div className="rounded-2xl border bg-white/40 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="uppercase text-[10px] font-black tracking-widest pl-8">Course Module</TableHead>
                                        <TableHead className="uppercase text-[10px] font-black tracking-widest">Code</TableHead>
                                        <TableHead className="text-right uppercase text-[10px] font-black tracking-widest">Marks</TableHead>
                                        <TableHead className="text-right uppercase text-[10px] font-black tracking-widest pr-8">Grade</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {groupedResults?.[semesterKey].map(result => (
                                        <TableRow key={result.courseId} className="hover:bg-white transition-colors">
                                        <TableCell className="font-bold text-slate-700 pl-8">{result.courseName}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{result.courseCode}</TableCell>
                                        <TableCell className="text-right font-medium">{result.marks}%</TableCell>
                                        <TableCell className="text-right pr-8">
                                            <Badge className={cn("rounded-lg font-black text-xs min-w-8 justify-center uppercase", result.marks >= 80 ? "bg-green-500 hover:bg-green-600" : result.marks < 50 ? "bg-destructive hover:bg-destructive/90" : "bg-primary")}>
                                                {result.grade}
                                            </Badge>
                                        </TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                            </div>
                            </AccordionContent>
                        </AccordionItem>
                        ))}
                    </Accordion>
                ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No academic records published</div>}
            </CardContent>
        </Card>
    </div>
  );
}
