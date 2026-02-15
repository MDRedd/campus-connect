
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, getDocs, query, doc, serverTimestamp, collectionGroup, where, orderBy } from 'firebase/firestore';
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
  PlusCircle,
  Edit,
  Trash2,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFacultyCourses } from '@/hooks/use-faculty-courses';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Types based on backend.json
type Course = { id: string; name: string; code: string; };
type Forum = { id: string; courseId: string; title: string; description: string; courseCode?: string; courseName?: string; };
type Club = { id: string; name: string; description: string; facultyIncharge: string; members?: string[]; };
type Event = { id: string; title: string; description: string; date: string; time: string; location: string; organizer: string; };
type CommunityPost = { id: string; title: string; description: string; studentId: string; studentName: string; createdAt: any; };
type UserProfile = { id: string; name: string; role: string; };


const clubSchema = z.object({
  name: z.string().min(3, 'Club name must be at least 3 characters long.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.'),
  facultyIncharge: z.string().min(1, 'Please select a faculty in-charge.'),
});

const eventSchema = z.object({
    title: z.string().min(3, 'Title is required.'),
    description: z.string().optional(),
    date: z.string().min(1, 'Date is required.'),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (e.g., 14:30).'),
    location: z.string().min(3, 'Location is required.'),
    organizer: z.string().min(3, 'Organizer is required.'),
});

const forumSchema = z.object({
  courseId: z.string().min(1, 'Please select a course.'),
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.'),
});

const communityPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  description: z.string().min(10, 'Description is required.'),
});


export default function EngagementPage() {
    const firestore = useFirestore();
    const { user, profile: userProfile, isUserLoading } = useUser();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [openClubDialog, setOpenClubDialog] = useState(false);
    const [openEventDialog, setOpenEventDialog] = useState(false);
    const [openForumDialog, setOpenForumDialog] = useState(false);
    const [openCommunityPostDialog, setOpenCommunityPostDialog] = useState(false);
    const [editingClub, setEditingClub] = useState<Club | null>(null);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [openEventDetailsDialog, setOpenEventDetailsDialog] = useState(false);

    const [forums, setForums] = useState<Forum[] | null>(null);
    const [areForumsLoading, setAreForumsLoading] = useState(true);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const isFacultyOrAdmin = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');
    const isSuperAdmin = userProfile?.role === 'super-admin';
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

    const coursesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'courses');
    }, [firestore, user]);
    const { data: allCourses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);
    
    const allFacultyQuery = useMemoFirebase(() => {
        if (!firestore || !isSuperAdmin) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'faculty'));
    }, [firestore, isSuperAdmin]);
    const { data: allFaculty, isLoading: areFacultyLoading } = useCollection<UserProfile>(allFacultyQuery);

    const clubsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'clubs');
    }, [firestore, user]);
    const { data: clubs, isLoading: areClubsLoading } = useCollection<Club>(clubsQuery);

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'events'), 
            orderBy('date', 'asc')
        );
    }, [firestore, user]);
    const { data: events, isLoading: areEventsLoading } = useCollection<Event>(eventsQuery);

    const communityPostsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'communityPosts'), orderBy('createdAt', 'desc'));
    }, [firestore]);
    const { data: communityPosts, isLoading: areCommunityPostsLoading } = useCollection<CommunityPost>(communityPostsQuery);
    
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
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'forums', operation: 'list' }));
                setForums([]);
            } finally {
                setAreForumsLoading(false);
            }
        };

        fetchForums();
    }, [firestore, allCourses, areCoursesLoading, refetchTrigger]);
    
    const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

    const filteredForums = useMemo(() => {
        if (!forums) return null;
        if (!searchQuery) return forums;
        return forums.filter(forum => 
            forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            forum.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [forums, searchQuery]);

    const filteredEvents = useMemo(() => {
        if (!events) return null;
        return events.filter(event => new Date(event.date) >= new Date());
    }, [events]);

    const clubForm = useForm<z.infer<typeof clubSchema>>({
      resolver: zodResolver(clubSchema),
    });
    const eventForm = useForm<z.infer<typeof eventSchema>>({
      resolver: zodResolver(eventSchema),
    });
    const forumForm = useForm<z.infer<typeof forumSchema>>({
      resolver: zodResolver(forumSchema),
    });
    const communityPostForm = useForm<z.infer<typeof communityPostSchema>>({
        resolver: zodResolver(communityPostSchema),
    });

    const clubImage = PlaceHolderImages.find((img) => img.id === 'club-activity');
    const eventImage = PlaceHolderImages.find((img) => img.id === 'campus-event');
    
    const handleAddNewClub = () => {
        setEditingClub(null);
        clubForm.reset();
        setOpenClubDialog(true);
    };

    const handleEditClub = (club: Club) => {
        setEditingClub(club);
        clubForm.reset({
            name: club.name,
            description: club.description,
            facultyIncharge: club.facultyIncharge,
        });
        setOpenClubDialog(true);
    };

    const handleDeleteClub = (clubId: string) => {
        if (!firestore || !confirm('Are you sure you want to delete this club?')) return;
        deleteDocumentNonBlocking(doc(firestore, 'clubs', clubId));
        toast({ title: 'Success', description: 'Club deleted.' });
    };
    
    function onClubSubmit(values: z.infer<typeof clubSchema>) {
      if (!firestore || !user) return;

      if (editingClub) {
          const clubRef = doc(firestore, 'clubs', editingClub.id);
          updateDocumentNonBlocking(clubRef, values);
          toast({ title: 'Success', description: 'Club updated successfully.' });
      } else {
          const clubData = {
              ...values,
              members: [],
          };
          addDocumentNonBlocking(collection(firestore, 'clubs'), clubData);
          toast({ title: 'Success', description: 'Club created successfully.' });
      }
      setOpenClubDialog(false);
      setEditingClub(null);
      clubForm.reset();
    }
    
    const handleAddNewEvent = () => {
        setEditingEvent(null);
        eventForm.reset();
        setOpenEventDialog(true);
    };

    const handleEditEvent = (event: Event) => {
        setEditingEvent(event);
        eventForm.reset({
            ...event,
            date: format(new Date(event.date), 'yyyy-MM-dd')
        });
        setOpenEventDialog(true);
    };

    const handleDeleteEvent = (eventId: string) => {
        if (!firestore || !confirm('Are you sure you want to delete this event?')) return;
        deleteDocumentNonBlocking(doc(firestore, 'events', eventId));
        toast({ title: 'Success', description: 'Event deleted.' });
    };

    const handleViewDetails = (event: Event) => {
        setSelectedEvent(event);
        setOpenEventDetailsDialog(true);
    }

    function onEventSubmit(values: z.infer<typeof eventSchema>) {
        if (!firestore) return;
        
        const eventData = {
            ...values,
            date: new Date(values.date).toISOString()
        };

        if (editingEvent) {
            updateDocumentNonBlocking(doc(firestore, 'events', editingEvent.id), eventData);
            toast({ title: 'Success', description: 'Event updated.' });
        } else {
            addDocumentNonBlocking(collection(firestore, 'events'), eventData);
            toast({ title: 'Success', description: 'Event created.' });
        }
        setOpenEventDialog(false);
        setEditingEvent(null);
    }
    
    function onCreateForum(values: z.infer<typeof forumSchema>) {
      if (!firestore || !user) return;
      
      const forumsRef = collection(firestore, 'courses', values.courseId, 'forums');
      addDocumentNonBlocking(forumsRef, {
          courseId: values.courseId,
          title: values.title,
          description: values.description,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
      });
      
      toast({ title: 'Success', description: 'Forum created. The list will update shortly.' });
      setOpenForumDialog(false);
      forumForm.reset();
      setRefetchTrigger(c => c + 1);
    }

    function onCommunityPostSubmit(values: z.infer<typeof communityPostSchema>) {
        if (!firestore || !user || !userProfile) return;
        addDocumentNonBlocking(collection(firestore, 'communityPosts'), {
            title: values.title,
            description: values.description,
            studentId: user.uid,
            studentName: userProfile.name,
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Success', description: 'Your post has been published.' });
        setOpenCommunityPostDialog(false);
        communityPostForm.reset();
    }

    const isLoading = isUserLoading || areCoursesLoading || areClubsLoading || areEventsLoading || (isSuperAdmin && areFacultyLoading);
    const isForumCreationLoading = areCoursesLoading || (userProfile?.role === 'faculty' && areFacultyCoursesLoading);
    const coursesForForum = userProfile?.role?.includes('admin') ? allCourses : facultyCourses;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Engagement</h1>
        <p className="text-muted-foreground">
          Connect with peers, join clubs, and participate in events.
        </p>
      </div>

      <Tabs defaultValue="forums" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="forums">
            <MessageSquare className="mr-2 h-4 w-4" />
            Forums
          </TabsTrigger>
          <TabsTrigger value="community">
            <MessageCircle className="mr-2 h-4 w-4" />
            Community
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
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Discussion Forums</CardTitle>
                        <CardDescription>
                            Engage in conversations, ask questions, and share knowledge.
                        </CardDescription>
                    </div>
                    {isFacultyOrAdmin && (
                        <Dialog open={openForumDialog} onOpenChange={setOpenForumDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Create Forum</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create New Forum</DialogTitle></DialogHeader>
                                {isForumCreationLoading ? <Skeleton className="h-64" /> : (
                                <Form {...forumForm}>
                                    <form onSubmit={forumForm.handleSubmit(onCreateForum)} className="space-y-4">
                                        <FormField control={forumForm.control} name="courseId" render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Course</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger></FormControl>
                                                <SelectContent>{coursesForForum?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={forumForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Forum Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={forumForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">Create Forum</Button></DialogFooter>
                                    </form>
                                </Form>
                                )}
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
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
        
        <TabsContent value="community" className="mt-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Community Board</CardTitle>
                            <CardDescription>
                                A place for all campus members to post and connect.
                            </CardDescription>
                        </div>
                        <Dialog open={openCommunityPostDialog} onOpenChange={setOpenCommunityPostDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Create Post</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Create New Community Post</DialogTitle></DialogHeader>
                                <Form {...communityPostForm}>
                                    <form onSubmit={communityPostForm.handleSubmit(onCommunityPostSubmit)} className="space-y-4">
                                        <FormField control={communityPostForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={communityPostForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">Create Post</Button></DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {areCommunityPostsLoading ? (
                        <>
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </>
                    ) : communityPosts && communityPosts.length > 0 ? (
                        communityPosts.map((post) => (
                            <Card key={post.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{post.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{post.description}</p>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={post.studentName} />}
                                            <AvatarFallback>{post.studentName.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <Link href={`/users/${post.studentId}`} className="hover:underline text-foreground font-medium">
                                            {post.studentName}
                                        </Link>
                                    </div>
                                    <span>{format(post.createdAt.toDate(), 'PPP')}</span>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                            <MessageCircle className="h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">The board is empty!</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Be the first to create a post on the community board.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="clubs" className="mt-6">
            <Card>
                <CardHeader className="flex-row justify-between items-start">
                    <div>
                        <CardTitle>Student Clubs</CardTitle>
                        <CardDescription>Find your community and explore your interests.</CardDescription>
                    </div>
                    {isSuperAdmin && (
                        <Dialog open={openClubDialog} onOpenChange={setOpenClubDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={handleAddNewClub}><PlusCircle className="mr-2 h-4 w-4" /> Create Club</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{editingClub ? 'Edit Club' : 'Create New Club'}</DialogTitle></DialogHeader>
                                {areFacultyLoading ? <Skeleton className="h-64"/> : (
                                <Form {...clubForm}>
                                    <form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-4">
                                        <FormField control={clubForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Club Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={clubForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={clubForm.control} name="facultyIncharge" render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Faculty In-Charge</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select a faculty member" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {allFaculty?.map(f => (
                                                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">{editingClub ? 'Save Changes': 'Create Club'}</Button></DialogFooter>
                                    </form>
                                </Form>
                                )}
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading ? (
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
                            const canManageClub = isSuperAdmin || (userProfile?.role === 'faculty' && club.facultyIncharge === user?.uid);
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
                                    <div className="flex justify-between items-start">
                                      <CardTitle>{club.name}</CardTitle>
                                      {canManageClub && (
                                          <div className="flex items-center -mr-2 -mt-2">
                                              <Button variant="ghost" size="icon" onClick={() => handleEditClub(club)}><Edit className="h-4 w-4" /></Button>
                                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClub(club.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                          </div>
                                      )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">{club.description}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/engagement/club/${club.id}`}>
                                            View Details <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
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
                <CardHeader className="flex-row justify-between items-start">
                    <div>
                        <CardTitle>Upcoming Events</CardTitle>
                        <CardDescription>Don't miss out on what's happening on campus.</CardDescription>
                    </div>
                     {isFacultyOrAdmin && (
                        <Dialog open={openEventDialog} onOpenChange={setOpenEventDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={handleAddNewEvent}><PlusCircle className="mr-2 h-4 w-4" /> Create Event</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle></DialogHeader>
                                <Form {...eventForm}>
                                    <form onSubmit={eventForm.handleSubmit(onEventSubmit)} className="space-y-4">
                                        <FormField control={eventForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Event Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={eventForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={eventForm.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                            <FormField control={eventForm.control} name="time" render={({ field }) => ( <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        </div>
                                        <FormField control={eventForm.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={eventForm.control} name="organizer" render={({ field }) => ( <FormItem><FormLabel>Organizer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">{editingEvent ? 'Save Changes' : 'Create Event'}</Button></DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    )}
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
                     ) : filteredEvents && filteredEvents.length > 0 ? (
                        filteredEvents.map(event => (
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
                                    <span>{format(new Date(event.date), 'PPP')} at {event.time}</span>
                                </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span>{event.location}</span>
                                </div>
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                    {isFacultyOrAdmin ? (
                                        <>
                                            <Button variant="outline" size="sm" className="w-full" onClick={() => handleEditEvent(event)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </>
                                    ) : (
                                        <Button variant="secondary" className="w-full" onClick={() => handleViewDetails(event)}>View Details</Button>
                                    )}
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
      <Dialog open={openEventDetailsDialog} onOpenChange={setOpenEventDetailsDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{selectedEvent?.title}</DialogTitle>
                <DialogDescription>
                    Organized by {selectedEvent?.organizer}
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground">{selectedEvent?.description}</p>
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent ? `${format(new Date(selectedEvent.date), 'PPP')} at ${selectedEvent.time}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent?.location}</span>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button>Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </div>
  );
}
