'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileWarning, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export type UpcomingAssignment = {
  id: string;
  courseId: string;
  title: string;
  deadline: string;
  courseCode: string;
};

type UpcomingDeadlinesProps = {
  assignments: UpcomingAssignment[];
};

export default function UpcomingDeadlines({ assignments }: UpcomingDeadlinesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
        <CardDescription>Assignments that are due soon.</CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length > 0 ? (
          <ul className="space-y-4">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg">
                  <FileWarning className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{assignment.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Due: <span className="font-medium">{format(new Date(assignment.deadline), 'PPP')}</span> for {assignment.courseCode}
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/academics/assignment/${assignment.id}?courseId=${assignment.courseId}`}>
                    View <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
            <FileWarning className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Upcoming Deadlines</h3>
            <p className="mt-1 text-sm text-muted-foreground">You're all caught up on your assignments!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
