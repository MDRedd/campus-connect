import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimetableEntry } from '@/lib/data';
import { Clock, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UpcomingClassesProps = {
  timetable: TimetableEntry[];
};

export default function UpcomingClasses({ timetable }: UpcomingClassesProps) {
    const today = new Date();
    const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });

    // For demo, we'll just show all classes from the mock data
    const upcoming = timetable.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Classes</CardTitle>
        <CardDescription>Your schedule for {dayOfWeek}.</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length > 0 ? (
          <ul className="space-y-4">
            {upcoming.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="bg-primary/10 text-primary p-3 rounded-lg">
                    <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{entry.course.name}</p>
                  <p className="text-sm text-muted-foreground">{entry.facultyName} | Room: {entry.room}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{entry.startTime} - {entry.endTime}</p>
                  <Button variant="ghost" size="sm" className="mt-1 text-primary">Join Online <Video className="ml-2 h-4 w-4"/></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-center py-8">No classes scheduled for today.</p>
        )}
      </CardContent>
    </Card>
  );
}
