'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UserX } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export type AtRiskStudent = {
  studentId: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  percentage: number;
};

type StudentsAtRiskProps = {
  students: AtRiskStudent[];
};

export default function StudentsAtRisk({ students }: StudentsAtRiskProps) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Students at Risk</CardTitle>
        <CardDescription>Students with attendance below 75% in your courses.</CardDescription>
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
                  <p className="font-semibold">{student.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.percentage}% attendance in {student.courseCode}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/attendance/view/${student.courseId}`}>
                    View Course <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
            <UserX className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Great Work!</h3>
            <p className="mt-1 text-sm text-muted-foreground">No students are currently at risk due to low attendance.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
