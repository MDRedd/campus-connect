import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Announcement } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

type RecentAnnouncementsProps = {
  announcements: Announcement[];
};

export default function RecentAnnouncements({ announcements }: RecentAnnouncementsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Announcements</CardTitle>
        <CardDescription>Stay updated with the latest news from the campus.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="py-4">
              <div className="flex items-start justify-between">
                <div>
                    <h3 className="font-semibold">{announcement.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{announcement.content}</p>
                </div>
                <time className="text-sm text-muted-foreground whitespace-nowrap ml-4">{announcement.date}</time>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm">View All <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
