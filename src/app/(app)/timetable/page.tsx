'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { studentTimetable } from '@/lib/data';
import type { TimetableEntry } from '@/lib/data';
import { Clock, User, MapPin } from 'lucide-react';

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

export default function TimetablePage() {
  
  const timetableByDay = daysOfWeek.reduce((acc, day) => {
      acc[day] = studentTimetable.filter(t => t.day === day);
      return acc;
  }, {} as Record<string, TimetableEntry[]>);

  // For demo purposes, let's make sure every day has something, and some days are empty
  timetableByDay['Thursday'] = [
      { ...studentTimetable[0], id: 'tt5', day: 'Thursday', startTime: '09:00', endTime: '10:00' }
  ];
  timetableByDay['Friday'] = [];


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Class Timetable</h1>
        <p className="text-muted-foreground">
          Your weekly class schedule.
        </p>
      </div>

      <Tabs defaultValue="Monday" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {daysOfWeek.map((day) => (
            <TabsTrigger key={day} value={day}>
              {day}
            </TabsTrigger>
          ))}
        </TabsList>

        {daysOfWeek.map((day) => (
          <TabsContent key={day} value={day} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{day}'s Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {timetableByDay[day].length > 0 ? (
                  <ul className="space-y-4">
                    {timetableByDay[day].map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{entry.course.name}</p>
                          <p className="text-sm text-muted-foreground">{entry.course.code}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{entry.startTime} - {entry.endTime}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{entry.facultyName}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>Room: {entry.room}</span>
                            </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No classes scheduled for {day}.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
