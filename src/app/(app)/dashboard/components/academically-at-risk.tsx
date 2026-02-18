'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UserX, Send } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export type AcademicallyAtRiskStudent = {
  studentId: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  grade: string;
  marks: number;
};

type StudentsAtRiskProps = {
  students: AcademicallyAtRiskStudent[];
  onNudge?: (student: AcademicallyAtRiskStudent) => void;
};

export default function AcademicallyAtRisk({ students, onNudge }: StudentsAtRiskProps) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academically At-Risk Students</CardTitle>
        <CardDescription>Students with low grades in your courses.</CardDescription>
      </CardHeader>
      <CardContent>
        {students.length > 0 ? (
          <ul className="space-y-4">
            {students.map((student) => (
              <li key={`${student.studentId}-${student.courseId}`} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-9 w-9">
                  {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={student.studentName} data-ai-hint="person portrait" />}
                  <AvatarFallback>{student.studentName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Link href={`/users/${student.studentId}`} className="font-semibold hover:underline">
                    {student.studentName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Grade <span className="font-bold text-destructive">{student.grade}</span> ({student.marks}%) in {student.courseCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                    {onNudge && (
                        <Button variant="outline" size="sm" onClick={() => onNudge(student)}>
                            <Send className="mr-2 h-4 w-4" /> Nudge
                        </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/results`}>
                            View Results <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
            <UserX className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Excellent Standings!</h3>
            <p className="mt-1 text-sm text-muted-foreground">No students are currently at academic risk in your courses.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
