'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, PlusCircle, Edit, Trash2, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { generatePersonalizedNotification } from '@/ai/flows/personalized-notification-generation';
import { generateAnnouncementDraft } from '@/ai/flows/generate-announcement-draft';

type Announcement = {
  id: string;
  title: string;
  description: string;
  targetAudience: 'all' | 'students' | 'faculty';
  date: any; // Can be Timestamp or string
  postedBy: string;
};

type UserForNotification = {
  id: string;
  name: string;
  role: 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
};

const announcementSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  targetAudience: z.enum(['all', 'students', 'faculty']),
});

export default function AnnouncementsPage() {
  const { user: authUser, profile: currentUserProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [openDialog, setOpenDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'announcements'), orderBy('date', 'desc'));
  }, [firestore]);
  const { data: announcements, isLoading: areAnnouncementsLoading } = useCollection<Announcement>(announcementsQuery);
  
  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (currentUserProfile?.role.includes('admin') || currentUserProfile?.role === 'faculty') {
        return collection(firestore, 'users');
    }
    return null;
  }, [firestore, currentUserProfile]);
  const { data: allUsers } = useCollection<UserForNotification>(allUsersQuery);

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
  });

  const handleEditClick = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    form.reset({
        title: announcement.title,
        description: announcement.description,
        targetAudience: announcement.targetAudience,
    });
    setOpenDialog(true);
  };

  const handleAddNewClick = () => {
    setEditingAnnouncement(null);
    form.reset({
        title: '',
        description: '',
        targetAudience: 'all',
    });
    setOpenDialog(true);
  }

  const handleDelete = (announcementId: string) => {
    if (!firestore) return;
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) return;
    const announcementRef = doc(firestore, 'announcements', announcementId);
    deleteDocumentNonBlocking(announcementRef);
    toast({ title: 'Success', description: 'Announcement deleted.' });
  }

  const handleAIDraft = async () => {
      const currentDesc = form.getValues('description');
      const audience = form.getValues('targetAudience');
      
      if (!currentDesc || currentDesc.length < 10) {
          toast({ variant: 'destructive', title: 'Input required', description: 'Please provide some key points in the description first.' });
          return;
      }

      setIsDrafting(true);
      try {
          const result = await generateAnnouncementDraft({
              keyPoints: currentDesc,
              targetAudience: audience,
          });
          form.setValue('title', result.title);
          form.setValue('description', result.description);
          toast({ title: 'AI Draft Generated', description: 'Your announcement has been refined.' });
      } catch (e) {
          console.error("Error drafting with AI:", e);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not generate AI draft.' });
      } finally {
          setIsDrafting(false);
      }
  }

  async function onSubmit(values: z.infer<typeof announcementSchema>) {
    if (!firestore || !authUser) return;
    
    const isNewAnnouncement = !editingAnnouncement;
    let newAnnouncementId: string | null = null;

    if (editingAnnouncement) {
        const announcementRef = doc(firestore, 'announcements', editingAnnouncement.id);
        updateDocumentNonBlocking(announcementRef, {
            ...values,
            date: serverTimestamp(),
        });
        toast({ title: 'Success', description: 'Announcement updated.' });
    } else {
        const announcementsRef = collection(firestore, 'announcements');
        const newAnnouncementRef = await addDocumentNonBlocking(announcementsRef, {
            ...values,
            date: serverTimestamp(),
            postedBy: authUser.uid,
        });
        if (newAnnouncementRef) {
            newAnnouncementId = newAnnouncementRef.id;
        }
        toast({ title: 'Success', description: 'Announcement posted.' });
    }
    setOpenDialog(false);
    setEditingAnnouncement(null);
    form.reset();

    if (isNewAnnouncement && allUsers && allUsers.length > 0 && newAnnouncementId) {
        const link = `/announcements/view`;
        (async () => {
            const targetUsers = allUsers.filter(user => {
                if (values.targetAudience === 'all') return true;
                if (values.targetAudience === 'students' && user.role === 'student') return true;
                if (values.targetAudience === 'faculty' && user.role === 'faculty') return true;
                return false;
            });
            
            for (const user of targetUsers) {
                try {
                    const notificationResult = await generatePersonalizedNotification({
                        userId: user.id,
                        userName: user.name,
                        updateType: 'generalAnnouncement',
                        details: `Title: ${values.title}\n\n${values.description}`,
                    });
                    addDocumentNonBlocking(collection(firestore, 'users', user.id, 'notifications'), {
                        userId: user.id,
                        message: notificationResult.notificationMessage,
                        read: false,
                        createdAt: new Date().toISOString(),
                        link: link,
                    });
                } catch (e) {
                    console.error(`Failed to generate or send notification for user ${user.id}`, e);
                }
            }
        })();
    }
  }

  const isLoading = isUserLoading || areAnnouncementsLoading;
  const canManageAnnouncements = currentUserProfile?.role === 'faculty' || currentUserProfile?.role.includes('admin');

  if (isUserLoading) {
      return <Skeleton className="h-96 w-full" />;
  }

  if (!canManageAnnouncements) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have permission to view this page.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
        <p className="text-muted-foreground">
          Create, edit, and manage platform-wide announcements.
        </p>
      </div>
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>All Announcements</CardTitle>
            <CardDescription>A list of all posted announcements.</CardDescription>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
                <Button onClick={handleAddNewClick}><PlusCircle className="mr-2 h-4 w-4" /> New Announcement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="targetAudience" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Target Audience</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select an audience" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    <SelectItem value="students">Students Only</SelectItem>
                                    <SelectItem value="faculty">Faculty Only</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., Mid-term Exam Schedule" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <div className="flex justify-between items-center">
                                    <FormLabel>Description / Key Points</FormLabel>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAIDraft} disabled={isDrafting}>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {isDrafting ? 'Refining...' : 'Refine with AI'}
                                    </Button>
                                </div>
                                <FormControl><Textarea rows={8} {...field} placeholder="Enter full details or just key points to refine with AI..." /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit">{editingAnnouncement ? 'Save Changes' : 'Post Announcement'}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : announcements && announcements.length > 0 ? (
                announcements.map(announcement => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">{announcement.title}</TableCell>
                    <TableCell className="capitalize">{announcement.targetAudience}</TableCell>
                    <TableCell>
                      {announcement.date ? format(announcement.date.toDate(), 'PPP') : '...'}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(announcement)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(announcement.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No announcements found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
