'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, getDocs, query, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Users,
  Calendar as CalendarIcon,
  Search,
  ArrowRight,
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// Types based on backend.json
type Course = { id: string; name: string; code: string; };
type Forum = { id: string; courseId: string; title: string; description: string; courseCode?: string; courseName?: string; };
type Club = { id: string; name: string; description: string; facultyIncharge: string; members?: string[]; };
type Event = { id: string; title: string; description: string; date: string; time: string; location: string; organizer: string; };

export default function EngagementPage() {
    const firestore = useFirestore();
    const { user, isUserLoading: isAuthLoading } = useUser();
    const { toast } = useToast();
    const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [forums, setForums] = useState<Forum[] | null>(null);
    const [areForumsLoading, setAreForumsLoading] = useState(true);

    const coursesQuery = useMemoFirebase(() => {
        if (!firestore || isAuthLoading || !user) return null;
        return collection(firestore, 'courses');
    }, [firestore, isAuthLoading, user]);
    const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);

    const clubsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'clubs');
    }, [firestore, user]);
    const { data: clubs, isLoading: areClubsLoading } = useCollection<Club>(clubsQuery);

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'events');
    }, [firestore, user]);
    const { data: events, isLoading: areEventsLoading } = useCollection<Event>(eventsQuery);
    
    // Fetch all forums from all courses
    useEffect(() => {
        if (!firestore || areCoursesLoading) return;
        if (!allCourses) {
            setForums([]);
            setAreForumsLoading(false);
            return;
        }

        const fetchForums = async () => {
            setAreForumsLoading(true);
            const allForums: Forum[] = [];
            try {
                for (const course of allCourses) {
                    const forumsQuery = query(collection(firestore, 'courses', course.id, 'forums'));
                    const querySnapshot = await getDocs(forumsQuery);
                    querySnapshot.forEach((doc) => {
                        allForums.push({
                            id: doc.id,
                            courseCode: course.code,
                            courseName: course.name,
                            ...(doc.data() as Omit<Forum, 'id'>)
                        });
                    });
                }
                setForums(allForums);
            } catch (error) {
                console.error("Error fetching forums:", error);
                setForums([]);
            } finally {
                setAreForumsLoading(false);
            }
        };

        fetchForums();
    }, [firestore, allCourses, areCoursesLoading]);

    const filteredForums = useMemo(() => {
        if (!forums) return null;
        if (!searchQuery) return forums;
        return forums.filter(forum => 
            forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            forum.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [forums, searchQuery]);


    const clubImage = PlaceHolderImages.find((img) => img.id === 'club-activity');
    const eventImage = PlaceHolderImages.find((img) => img.id === 'campus-event');

    const handleJoinClub = async (clubId: string) => {
        if (!firestore || !user) return;
        setJoiningClubId(clubId);
        try {
            const clubRef = doc(firestore, 'clubs', clubId);
            await updateDoc(clubRef, {
                members: arrayUnion(user.uid)
            });
            toast({
                title: "Successfully Joined Club!",
                description: "Welcome to the club. You can now participate in its activities.",
            });
        } catch (error) {
            console.error("Error joining club:", error);
            toast({
                variant: 'destructive',
                title: "Failed to Join",
                description: "There was a problem joining the club. Please try again later.",
            });
        } finally {
            setJoiningClubId(null);
        }
    };

    const isLoading = isAuthLoading || areCoursesLoading || areClubsLoading || areEventsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Engagement</h1>
        <p className="text-muted-foreground">
          Connect with peers, join clubs, and participate in events.
        </p>
      </div>

      <Tabs defaultValue="forums" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="forums">
            <MessageSquare className="mr-2 h-4 w-4" />
            Forums
          </TabsTrigger>
          <TabsTrigger value="clubs">
            <Users className="mr-2 h-4 w-4" />
            Clubs
          </TabsTrigger>
          <TabsTrigger value="events">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forums" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Discussion Forums</CardTitle>
              <CardDescription>
                Engage in conversations, ask questions, and share knowledge.
              </CardDescription>
              <div className="relative pt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search forums by title or description..." 
                    className="pl-8 w-full md:w-1/2 lg:w-1/3" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading || areForumsLoading ? (
                <>
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </>
              ) : filteredForums && filteredForums.length > 0 ? (
                filteredForums.map((forum) => (
                  <Card key={forum.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{forum.title}</CardTitle>
                      <CardDescription>{forum.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{forum.courseCode}</span>
                          </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                       <Button asChild>
                        <Link href={`/engagement/forum/${forum.id}?courseId=${forum.courseId}`}>
                          View Forum <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <MessageSquare className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Forums Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {searchQuery ? `No forums match "${searchQuery}".` : "Check back later for discussions."}
                    </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clubs" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Student Clubs</CardTitle>
                    <CardDescription>Find your community and explore your interests.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {areClubsLoading ? (
                         [...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-0"><Skeleton className="h-48 w-full" /></CardContent>
                                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
                                <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                            </Card>
                         ))
                    ) : clubs && clubs.length > 0 ? (
                        clubs.map(club => {
                            const isMember = user ? club.members?.includes(user.uid) : false;
                            const isJoining = joiningClubId === club.id;
                            return (
                            <Card key={club.id} className="overflow-hidden flex flex-col">
                                {clubImage && (
                                    <Image
                                        src={clubImage.imageUrl}
                                        alt={club.name}
                                        width={600}
                                        height={400}
                                        className="h-48 w-full object-cover"
                                        data-ai-hint={clubImage.imageHint}
                                    />
                                )}
                                <CardHeader>
                                    <CardTitle>{club.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">{club.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button 
                                        className="w-full"
                                        onClick={() => handleJoinClub(club.id)}
                                        disabled={isJoining || isMember || !user}
                                    >
                                        {isJoining ? 'Joining...' : isMember ? 'Joined' : 'Join Club'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )})
                    ) : (
                        <Card className="md:col-span-2 lg:col-span-3">
                            <CardContent className="p-8 text-center">
                                <Users className="h-12 w-12 text-muted-foreground mx-auto" />
                                <h3 className="mt-4 text-lg font-semibold">No Clubs Available</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Student clubs will be listed here.</p>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
           <Card>
                <CardHeader>
                    <CardTitle>Upcoming Events</CardTitle>
                    <CardDescription>Don't miss out on what's happening on campus.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                     {areEventsLoading ? (
                        [...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-0"><Skeleton className="h-48 w-full" /></CardContent>
                                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
                                <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                            </Card>
                        ))
                     ) : events && events.length > 0 ? (
                        events.map(event => (
                            <Card key={event.id} className="overflow-hidden flex flex-col">
                                {eventImage && (
                                    <Image
                                        src={eventImage.imageUrl}
                                        alt={event.title}
                                        width={600}
                                        height={400}
                                        className="h-48 w-full object-cover"
                                        data-ai-hint={eventImage.imageHint}
                                    />
                                )}
                                <CardHeader>
                                    <CardTitle>{event.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-1 text-sm flex-grow">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{new Date(event.date).toLocaleDateString()} at {event.time}</span>
                                </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span>{event.location}</span>
                                </div>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="secondary" className="w-full">View Details</Button>
                                </CardFooter>
                            </Card>
                        ))
                     ) : (
                        <Card className="md:col-span-2 lg:col-span-3">
                            <CardContent className="p-8 text-center">
                                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                                <h3 className="mt-4 text-lg font-semibold">No Upcoming Events</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Check back later for new events.</p>
                            </CardContent>
                        </Card>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
