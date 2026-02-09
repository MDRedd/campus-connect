'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { format } from 'date-fns';

type Announcement = {
  id: string;
  title: string;
  description: string;
  targetAudience: 'all' | 'students' | 'faculty';
  date: any; // Can be Timestamp or string
};

type UserProfile = {
  role: 'student' | 'faculty' | 'admin';
};

export default function ViewAnnouncementsPage() {
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile) return null;
    
    // Admins see all announcements
    if (userProfile.role === 'admin') {
        return query(collection(firestore, 'announcements'), orderBy('date', 'desc'));
    }

    // Students and Faculty see 'all' plus their role-specific announcements
    const targetAudiences = ['all', userProfile.role];
    return query(
        collection(firestore, 'announcements'),
        where('targetAudience', 'in', targetAudiences),
        orderBy('date', 'desc')
    );

  }, [firestore, userProfile]);

  const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);

  const isLoading = isAuthUserLoading || isUserProfileLoading || areAnnouncementsLoading;

  return (
    <div className="flex flex-col gap-6">
       <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader>
            <CardTitle className="text-3xl">All Announcements</CardTitle>
            <CardDescription>Stay up-to-date with everything happening on campus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             {isLoading ? (
                <>
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </>
              ) : announcements && announcements.length > 0 ? (
                announcements.map(announcement => (
                  <Card key={announcement.id} className="flex gap-4 p-4 items-start">
                    <div className="bg-primary/10 text-primary p-3 rounded-lg mt-1">
                        <Megaphone className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-lg">{announcement.title}</h3>
                            <time className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                                {announcement.date ? format(announcement.date.toDate(), 'PPP') : '...'}
                            </time>
                        </div>
                        <p className="text-muted-foreground mt-1">{announcement.description}</p>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <Megaphone className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Announcements</h3>
                    <p className="mt-1 text-sm text-muted-foreground">There are no announcements for you at this time.</p>
                </div>
              )}
        </CardContent>
      </Card>
    </div>
  );
}
