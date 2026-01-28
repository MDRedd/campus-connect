'use client';

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
  Calendar,
  Search,
  ArrowRight,
} from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

// Mock data for demonstration purposes
const forums = [
  {
    id: 'forum-1',
    title: 'CS101 - Introduction to Programming Discussion',
    description: 'Discuss assignments, concepts, and get help from peers.',
    courseCode: 'CS101',
    members: 124,
    lastActivity: '2 hours ago',
  },
  {
    id: 'forum-2',
    title: 'Campus Life & Events',
    description: 'A place to discuss everything happening on campus.',
    courseCode: 'General',
    members: 532,
    lastActivity: '30 minutes ago',
  },
];

const clubs = [
  {
    id: 'club-1',
    name: 'Coding Club',
    description: 'For all the passionate coders and developers.',
    image: PlaceHolderImages.find((img) => img.id === 'club-activity'),
  },
  {
    id: 'club-2',
    name: 'Debate Society',
    description: 'Sharpen your arguments and public speaking skills.',
    image: PlaceHolderImages.find((img) => img.id === 'forum-discussion'),
  },
];

const events = [
  {
    id: 'event-1',
    title: 'Hackathon 2024',
    date: 'December 15-16, 2024',
    location: 'Main Auditorium',
    image: PlaceHolderImages.find((img) => img.id === 'campus-event'),
  },
  {
    id: 'event-2',
    title: 'Guest Lecture: AI & The Future',
    date: 'November 28, 2024',
    location: 'Seminar Hall B',
    image: PlaceHolderImages.find((img) => img.id === 'forum-discussion'),
  },
];

export default function EngagementPage() {
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
            <Calendar className="mr-2 h-4 w-4" />
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
                <Input placeholder="Search forums..." className="pl-8 w-full md:w-1/2 lg:w-1/3" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {forums.map((forum) => (
                <Card key={forum.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{forum.title}</CardTitle>
                    <CardDescription>{forum.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{forum.courseCode}</span>
                            <span className="text-xs">&#8226;</span>
                            <span>{forum.members} members</span>
                        </div>
                        <span>Last activity: {forum.lastActivity}</span>
                    </div>
                  </CardContent>
                   <CardFooter>
                    <Button>
                      View Forum <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
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
                    {clubs.map(club => (
                        <Card key={club.id} className="overflow-hidden">
                            {club.image && (
                                <Image
                                    src={club.image.imageUrl}
                                    alt={club.name}
                                    width={600}
                                    height={400}
                                    className="h-48 w-full object-cover"
                                    data-ai-hint={club.image.imageHint}
                                />
                            )}
                            <CardHeader>
                                <CardTitle>{club.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{club.description}</p>
                            </CardContent>
                             <CardFooter>
                                <Button className="w-full">Join Club</Button>
                            </CardFooter>
                        </Card>
                    ))}
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
                    {events.map(event => (
                        <Card key={event.id} className="overflow-hidden">
                            {event.image && (
                                 <Image
                                    src={event.image.imageUrl}
                                    alt={event.title}
                                    width={600}
                                    height={400}
                                    className="h-48 w-full object-cover"
                                    data-ai-hint={event.image.imageHint}
                                />
                            )}
                            <CardHeader>
                                <CardTitle>{event.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-1 text-sm">
                               <div className="flex items-center gap-2 text-muted-foreground">
                                   <Calendar className="h-4 w-4" />
                                   <span>{event.date}</span>
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
                    ))}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
