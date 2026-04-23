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
  Sparkles,
  Zap,
  Globe,
  Clock,
  ShieldCheck,
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// Types
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
        return query(collection(firestore, 'events'), orderBy('date', 'asc'));
    }, [firestore, user]);
    const { data: events, isLoading: areEventsLoading } = useCollection<Event>(eventsQuery);

    const communityPostsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'communityPosts'), orderBy('createdAt', 'desc'));
    }, [firestore]);
    const { data: communityPosts, isLoading: areCommunityPostsLoading } = useCollection<CommunityPost>(communityPostsQuery);
    
    useEffect(() => {
        if (!firestore || areCoursesLoading) return;
        if (!allCourses) { setForums([]); setAreForumsLoading(false); return; }
        const fetchForums = async () => {
            setAreForumsLoading(true);
            const allForums: Forum[] = [];
            try {
                for (const course of allCourses) {
                    const forumsQuery = query(collection(firestore, 'courses', course.id, 'forums'));
                    const querySnapshot = await getDocs(forumsQuery);
                    querySnapshot.forEach((doc) => {
                        allForums.push({ id: doc.id, courseCode: course.code, courseName: course.name, ...(doc.data() as Omit<Forum, 'id'>) });
                    });
                }
                setForums(allForums);
            } catch (error) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'forums', operation: 'list' }));
                setForums([]);
            } finally { setAreForumsLoading(false); }
        };
        fetchForums();
    }, [firestore, allCourses, areCoursesLoading, refetchTrigger]);
    
    const { facultyCourses, isLoading: areFacultyCoursesLoading } = useFacultyCourses();

    const filteredForums = useMemo(() => {
        if (!forums) return null;
        if (!searchQuery) return forums;
        return forums.filter(forum => forum.title.toLowerCase().includes(searchQuery.toLowerCase()) || forum.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [forums, searchQuery]);

    const filteredEvents = useMemo(() => {
        if (!events) return null;
        return events.filter(event => new Date(event.date) >= new Date());
    }, [events]);

    const clubForm = useForm<z.infer<typeof clubSchema>>({ resolver: zodResolver(clubSchema) });
    const eventForm = useForm<z.infer<typeof eventSchema>>({ resolver: zodResolver(eventSchema) });
    const forumForm = useForm<z.infer<typeof forumSchema>>({ resolver: zodResolver(forumSchema) });
    const communityPostForm = useForm<z.infer<typeof communityPostSchema>>({ resolver: zodResolver(communityPostSchema) });

    const clubImage = PlaceHolderImages.find((img) => img.id === 'club-activity');
    const eventImage = PlaceHolderImages.find((img) => img.id === 'campus-event');
    
    const handleAddNewClub = () => { setEditingClub(null); clubForm.reset(); setOpenClubDialog(true); };
    const handleEditClub = (club: Club) => { setEditingClub(club); clubForm.reset({ name: club.name, description: club.description, facultyIncharge: club.facultyIncharge }); setOpenClubDialog(true); };
    const handleDeleteClub = (clubId: string) => { if (!firestore || !confirm('Confirm deletion?')) return; deleteDocumentNonBlocking(doc(firestore, 'clubs', clubId)); toast({ title: 'Success', description: 'Club deleted.' }); };
    
    function onClubSubmit(values: z.infer<typeof clubSchema>) {
      if (!firestore || !user) return;
      if (editingClub) { updateDocumentNonBlocking(doc(firestore, 'clubs', editingClub.id), values); toast({ title: 'Success', description: 'Club updated.' }); } 
      else { addDocumentNonBlocking(collection(firestore, 'clubs'), { ...values, members: [] }); toast({ title: 'Success', description: 'Club created.' }); }
      setOpenClubDialog(false); setEditingClub(null); clubForm.reset();
    }
    
    const handleAddNewEvent = () => { setEditingEvent(null); eventForm.reset(); setOpenEventDialog(true); };
    const handleEditEvent = (event: Event) => { setEditingEvent(event); eventForm.reset({ ...event, date: format(new Date(event.date), 'yyyy-MM-dd') }); setOpenEventDialog(true); };
    const handleDeleteEvent = (eventId: string) => { if (!firestore || !confirm('Confirm deletion?')) return; deleteDocumentNonBlocking(doc(firestore, 'events', eventId)); toast({ title: 'Success', description: 'Event deleted.' }); };
    const handleViewDetails = (event: Event) => { setSelectedEvent(event); setOpenEventDetailsDialog(true); }

    function onEventSubmit(values: z.infer<typeof eventSchema>) {
        if (!firestore) return;
        const data = { ...values, date: new Date(values.date).toISOString() };
        if (editingEvent) { updateDocumentNonBlocking(doc(firestore, 'events', editingEvent.id), data); toast({ title: 'Success', description: 'Event updated.' }); } 
        else { addDocumentNonBlocking(collection(firestore, 'events'), data); toast({ title: 'Success', description: 'Event created.' }); }
        setOpenEventDialog(false); setEditingEvent(null);
    }
    
    function onCreateForum(values: z.infer<typeof forumSchema>) {
      if (!firestore || !user) return;
      addDocumentNonBlocking(collection(firestore, 'courses', values.courseId, 'forums'), { ...values, createdBy: user.uid, createdAt: serverTimestamp() });
      toast({ title: 'Success', description: 'Forum created.' });
      setOpenForumDialog(false); forumForm.reset(); setRefetchTrigger(c => c + 1);
    }

    function onCommunityPostSubmit(values: z.infer<typeof communityPostSchema>) {
        if (!firestore || !user || !userProfile) return;
        addDocumentNonBlocking(collection(firestore, 'communityPosts'), { ...values, studentId: user.uid, studentName: userProfile.name, createdAt: serverTimestamp() });
        toast({ title: 'Success', description: 'Post published.' });
        setOpenCommunityPostDialog(false); communityPostForm.reset();
    }

    const isLoading = isUserLoading || areCoursesLoading || areClubsLoading || areEventsLoading || (isSuperAdmin && areFacultyLoading);
    const coursesForForum = userProfile?.role?.includes('admin') ? allCourses : facultyCourses;

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <Sparkles className="h-3 w-3" /> Community Hub
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">ENGAGEMENT</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">
                      Build connections, participate in vibrant student life, and contribute to the campus community through forums and clubs.
                  </p>
              </div>
              <div className="hidden lg:block opacity-20"><Users className="h-32 w-32" /></div>
          </div>
      </div>

      <Tabs defaultValue="community" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4 h-12 p-1 bg-white/50 backdrop-blur-sm border rounded-xl">
          <TabsTrigger value="community" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Social</TabsTrigger>
          <TabsTrigger value="forums" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Forums</TabsTrigger>
          <TabsTrigger value="clubs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Clubs</TabsTrigger>
          <TabsTrigger value="events" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="community" className="mt-8">
            <Card className="glass-card border-none">
                <CardHeader className="flex flex-row justify-between items-center pb-8 border-b border-indigo-50/50">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight uppercase">COMMUNITY BOARD</CardTitle>
                        <CardDescription className="text-xs font-medium">A shared space for campus voices and daily updates.</CardDescription>
                    </div>
                    <Dialog open={openCommunityPostDialog} onOpenChange={setOpenCommunityPostDialog}>
                        <DialogTrigger asChild><Button className="rounded-xl shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[10px] h-11 px-6"><PlusCircle className="mr-2 h-4 w-4" /> Start Thread</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">New Community Thread</DialogTitle><DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Share your thoughts with the campus.</DialogDescription></DialogHeader>
                            <Form {...communityPostForm}><form onSubmit={communityPostForm.handleSubmit(onCommunityPostSubmit)} className="space-y-4 pt-4">
                                <FormField control={communityPostForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Headline</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={communityPostForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Content</FormLabel><FormControl><Textarea {...field} className="rounded-xl bg-slate-50 border-none shadow-inner min-h-[150px]" /></FormControl><FormMessage /></FormItem> )} />
                                <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">Publish Now</Button></DialogFooter>
                            </form></Form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="grid gap-6 mt-6">
                    {areCommunityPostsLoading ? <Skeleton className="h-48 w-full rounded-3xl" /> : communityPosts && communityPosts.length > 0 ? (
                        communityPosts.map((post) => (
                            <Card key={post.id} className="border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-3xl overflow-hidden group">
                                <CardContent className="p-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-black tracking-tight uppercase group-hover:text-primary transition-colors">{post.title}</h3>
                                        <Badge variant="secondary" className="rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/10 px-2 py-1">{post.createdAt ? format(post.createdAt.toDate(), 'MMM d') : '...'}</Badge>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium italic">"{post.description}"</p>
                                    <div className="flex items-center gap-3 pt-6 border-t border-indigo-50/50">
                                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                            {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={post.studentName} />}
                                            <AvatarFallback className="font-black text-[10px] uppercase bg-primary/5 text-primary">{post.studentName.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <Link href={`/users/${post.studentId}`} className="text-[10px] font-black text-slate-800 uppercase tracking-widest hover:underline block">{post.studentName}</Link>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Authorized Student</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No community activity indexed</div>}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="forums" className="mt-8">
          <Card className="glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between pb-8 border-b border-indigo-50/50">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight uppercase">ACADEMIC FORUMS</CardTitle>
                    <CardDescription className="text-xs font-medium">Subject-specific knowledge sharing and discourse.</CardDescription>
                </div>
                {isFacultyOrAdmin && (
                    <Dialog open={openForumDialog} onOpenChange={setOpenForumDialog}>
                        <DialogTrigger asChild><Button className="rounded-xl shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[10px] h-11 px-6"><PlusCircle className="mr-2 h-4 w-4" /> Create Forum</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">Establish New Forum</DialogTitle><DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Set up a specialized discussion space.</DialogDescription></DialogHeader>
                            <Form {...forumForm}><form onSubmit={forumForm.handleSubmit(onCreateForum)} className="space-y-4 pt-4">
                                <FormField control={forumForm.control} name="courseId" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Course</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue placeholder="Select course" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{coursesForForum?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={forumForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Title</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={forumForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Topic Overview</FormLabel><FormControl><Textarea {...field} className="rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">Launch Forum</Button></DialogFooter>
                            </form></Form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="grid gap-4 mt-6">
                <div className="relative mb-6 px-4">
                    <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input placeholder="Search forum directory..." className="pl-10 h-12 rounded-2xl bg-white/50 border-none shadow-inner text-sm font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                {areForumsLoading ? <Skeleton className="h-24 w-full rounded-2xl" /> : filteredForums && filteredForums.length > 0 ? (
                    filteredForums.map((forum) => (
                        <Card key={forum.id} className="border border-indigo-50/50 bg-white/40 hover:bg-white/80 transition-all rounded-2xl group overflow-hidden">
                            <CardHeader className="flex flex-row items-center gap-6 p-6">
                                <div className="bg-primary/5 text-primary p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500"><MessageSquare className="h-6 w-6" /></div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg font-black uppercase tracking-tight truncate leading-none">{forum.title}</CardTitle>
                                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">{forum.courseCode} • {forum.courseName}</CardDescription>
                                </div>
                                <Button asChild variant="secondary" className="rounded-xl h-10 px-8 shrink-0 font-black uppercase tracking-widest text-[10px]">
                                    <Link href={`/engagement/forum/${forum.id}?courseId=${forum.courseId}`}>Enter Forum <Zap className="ml-2 h-3 w-3 fill-current" /></Link>
                                </Button>
                            </CardHeader>
                        </Card>
                    ))
                ) : <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No matching forums found</div>}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="clubs" className="mt-8">
            <Card className="glass-card border-none">
                <CardHeader className="flex flex-row justify-between items-center pb-8 border-b border-indigo-50/50">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight uppercase">STUDENT GUILDS</CardTitle>
                        <CardDescription className="text-xs font-medium">Extracurricular organizations and interest groups.</CardDescription>
                    </div>
                    {isSuperAdmin && (
                        <Dialog open={openClubDialog} onOpenChange={setOpenClubDialog}>
                            <DialogTrigger asChild><Button className="rounded-xl shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-[10px] h-11 px-6"><PlusCircle className="mr-2 h-4 w-4" /> New Club</Button></DialogTrigger>
                            <DialogContent className="rounded-3xl">
                                <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">Register New Club</DialogTitle><DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Establish a new institutional student organization.</DialogDescription></DialogHeader>
                                <Form {...clubForm}><form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-4 pt-4">
                                    <FormField control={clubForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Club Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={clubForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mission Statement</FormLabel><FormControl><Textarea {...field} className="rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={clubForm.control} name="facultyIncharge" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sponsoring Faculty</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue placeholder="Select faculty" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{allFaculty?.map(f => ( <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem> ))}</SelectContent>
                                        </Select><FormMessage /></FormItem>
                                    )} />
                                    <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">Authorize Club</Button></DialogFooter>
                                </form></Form>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                    {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[2rem]" />) : clubs && clubs.length > 0 ? (
                        clubs.map(club => {
                            const canManageClub = isSuperAdmin || (userProfile?.role === 'faculty' && club.facultyIncharge === user?.uid);
                            return (
                            <Card key={club.id} className="glass-card border-none flex flex-col group overflow-hidden">
                                {clubImage && <div className="h-40 relative"><Image src={clubImage.imageUrl} alt={club.name} fill className="object-cover group-hover:scale-110 transition-transform duration-1000" data-ai-hint={clubImage.imageHint} /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /></div>}
                                <CardHeader className="relative -mt-12">
                                    <div className="flex justify-between items-end">
                                      <CardTitle className="text-xl font-black uppercase text-white tracking-tight leading-none">{club.name}</CardTitle>
                                      {canManageClub && ( <div className="flex gap-1 bg-white/20 backdrop-blur-md rounded-lg p-1 border border-white/20"><Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-primary" onClick={() => handleEditClub(club)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-destructive" onClick={() => handleDeleteClub(club.id)}><Trash2 className="h-4 w-4" /></Button></div> )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow pt-4">
                                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-medium">"{club.description}"</p>
                                </CardContent>
                                <CardFooter><Button asChild className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-11"><Link href={`/engagement/club/${club.id}`}>Membership Details <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardFooter>
                            </Card>
                        )})
                    ) : <div className="col-span-full text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No registered clubs indexed</div>}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-8">
           <Card className="glass-card border-none">
                <CardHeader className="flex flex-row justify-between items-center pb-8 border-b border-indigo-50/50">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight uppercase">UPCOMING SPECTACLES</CardTitle>
                        <CardDescription className="text-xs font-medium">Campus seminars, workshops, and festive events.</CardDescription>
                    </div>
                     {isFacultyOrAdmin && (
                        <Dialog open={openEventDialog} onOpenChange={setOpenEventDialog}>
                            <DialogTrigger asChild><Button className="rounded-xl shadow-lg shadow-accent/20 font-black uppercase tracking-widest text-[10px] h-11 px-6"><PlusCircle className="mr-2 h-4 w-4" /> Proclaim Event</Button></DialogTrigger>
                            <DialogContent className="rounded-3xl">
                                <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tight">Publish Campus Event</DialogTitle><DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Announce a new workshop or seminar.</DialogDescription></DialogHeader>
                                <Form {...eventForm}><form onSubmit={eventForm.handleSubmit(onEventSubmit)} className="space-y-4 pt-4">
                                    <FormField control={eventForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Event Headline</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={eventForm.control} name="description" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Agenda/Details</FormLabel><FormControl><Textarea {...field} className="rounded-xl bg-slate-50 border-none shadow-inner min-h-[100px]" /></FormControl><FormMessage /></FormItem> )} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={eventForm.control} name="date" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Event Date</FormLabel><FormControl><Input type="date" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={eventForm.control} name="time" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Time</FormLabel><FormControl><Input type="time" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={eventForm.control} name="location" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Venue</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={eventForm.control} name="organizer" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Hosting Body</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" /></FormControl><FormMessage /></FormItem> )} />
                                    <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">Announce Event</Button></DialogFooter>
                                </form></Form>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                     {areEventsLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[2rem]" />) : filteredEvents && filteredEvents.length > 0 ? (
                        filteredEvents.map(event => (
                            <Card key={event.id} className="glass-card border-none flex flex-col group overflow-hidden">
                                {eventImage && <div className="h-40 relative"><Image src={eventImage.imageUrl} alt={event.title} fill className="object-cover group-hover:scale-110 transition-transform duration-1000" data-ai-hint={eventImage.imageHint} /><div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" /></div>}
                                <CardHeader className="relative -mt-12">
                                    <CardTitle className="text-xl font-black uppercase text-white tracking-tight leading-tight">{event.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-3 pt-4 flex-grow">
                                    <div className="flex items-center gap-3 text-xs font-black text-muted-foreground uppercase tracking-widest"><CalendarIcon className="h-4 w-4 text-primary" /><span>{format(new Date(event.date), 'MMM d')} • {event.time}</span></div>
                                    <div className="flex items-center gap-3 text-xs font-black text-muted-foreground uppercase tracking-widest"><MapPin className="h-4 w-4 text-primary" /><span>{event.location}</span></div>
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                    {isFacultyOrAdmin ? (
                                        <>
                                            <Button variant="outline" size="sm" className="w-full rounded-xl font-black uppercase tracking-widest text-[10px]" onClick={() => handleEditEvent(event)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
                                            <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </>
                                    ) : <Button variant="secondary" className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-11" onClick={() => handleViewDetails(event)}>Reserve Access</Button>}
                                </CardFooter>
                            </Card>
                        ))
                     ) : <div className="col-span-full text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No upcoming events indexed</div>}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Global Event Details Dialog */}
      <Dialog open={openEventDetailsDialog} onOpenChange={setOpenEventDetailsDialog}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">{selectedEvent?.title}</DialogTitle>
                <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">HOSTED BY {selectedEvent?.organizer}</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{selectedEvent?.description}"</p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-indigo-50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Schedule</p>
                        <p className="text-xs font-bold text-slate-700">{selectedEvent ? format(new Date(selectedEvent.date), 'PPP') : ''} @ {selectedEvent?.time}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-indigo-50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Venue</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{selectedEvent?.location}</p>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px]">Close Entry</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </div>
  );
}