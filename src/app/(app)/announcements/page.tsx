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
  CardFooter
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, PlusCircle, Edit, Trash2, Sparkles, ShieldCheck } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { generateAnnouncementDraft } from '@/ai/flows/generate-announcement-draft';
import Link from 'next/link';

type Announcement = {
  id: string;
  title: string;
  description: string;
  targetAudience: 'all' | 'students' | 'faculty';
  date: any;
  postedBy: string;
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

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', description: '', targetAudience: 'all' }
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
  };

  const handleDelete = (announcementId: string) => {
    if (!firestore) return;
    if (!confirm('Excision protocol: Delete this announcement?')) return;
    const announcementRef = doc(firestore, 'announcements', announcementId);
    deleteDocumentNonBlocking(announcementRef);
    toast({ title: 'System Ledger Updated', description: 'Announcement excised.' });
  };

  const handleAIDraft = async () => {
      const currentDesc = form.getValues('description');
      const audience = form.getValues('targetAudience');
      
      if (!currentDesc || currentDesc.length < 10) {
          toast({ variant: 'destructive', title: 'Data Missing', description: 'Enter key points in the content field first.' });
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
          toast({ title: 'AI Synthesis Complete' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Flow Error', description: 'Could not synthesize AI draft.' });
      } finally {
          setIsDrafting(false);
      }
  };

  async function onSubmit(values: z.infer<typeof announcementSchema>) {
    if (!firestore || !authUser) return;
    
    if (editingAnnouncement) {
        const announcementRef = doc(firestore, 'announcements', editingAnnouncement.id);
        updateDocumentNonBlocking(announcementRef, { ...values, date: serverTimestamp() });
        toast({ title: 'Protocol Success', description: 'Announcement parameters updated.' });
    } else {
        const announcementsRef = collection(firestore, 'announcements');
        addDocumentNonBlocking(announcementsRef, {
            ...values,
            date: serverTimestamp(),
            postedBy: authUser.uid,
        });
        toast({ title: 'Transmission Active', description: 'Announcement disseminated across the network.' });
    }
    setOpenDialog(false);
    setEditingAnnouncement(null);
    form.reset();
  }

  const isLoading = isUserLoading || areAnnouncementsLoading;
  const canManageAnnouncements = currentUserProfile?.role === 'faculty' || currentUserProfile?.role.includes('admin');

  if (isUserLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;

  if (!canManageAnnouncements) {
    return (
        <div className="flex items-center justify-center p-8">
            <Card className="max-w-md w-full glass-card border-none">
                <CardHeader>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Access Restricted</CardTitle>
                    <CardDescription className="text-xs font-medium">Your persona does not have dissemination privileges for platform-wide alerts.</CardDescription>
                </CardHeader>
                <CardFooter><Button variant="secondary" className="w-full rounded-xl" asChild><Link href="/dashboard">Return to HUD</Link></Button></CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
      <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <Megaphone className="h-3 w-3" /> Communications Node
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">ANNOUNCEMENTS</h1>
                  <p className="text-indigo-100/70 font-medium max-w-lg">Manage institutional dissemination protocols and campus-wide alerts.</p>
              </div>
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild><Button onClick={handleAddNewClick} className="bg-white text-primary hover:bg-indigo-50 font-black rounded-xl h-12 px-8 shadow-xl shadow-black/20 uppercase tracking-widest text-[10px]"><PlusCircle className="mr-2 h-4 w-4" /> Proclaim Announcement</Button></DialogTrigger>
                <DialogContent className="sm:max-w-2xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">{editingAnnouncement ? 'Edit Transmission' : 'New Dissemination'}</DialogTitle>
                        <DialogDescription className="font-bold text-primary uppercase text-[10px] tracking-widest">Draft a system-wide institutional alert.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <FormField control={form.control} name="targetAudience" render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Persona Tier</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger className="glass-input"><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl"><SelectItem value="all">All Participants</SelectItem><SelectItem value="students">Students Only</SelectItem><SelectItem value="faculty">Faculty Only</SelectItem></SelectContent>
                                </Select></FormItem>
                            )} />
                            <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Headline</FormLabel><FormControl><Input {...field} className="glass-input" /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <div className="flex justify-between items-center mb-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Content / Key Points</FormLabel><Button type="button" variant="outline" size="sm" onClick={handleAIDraft} disabled={isDrafting} className="rounded-lg h-8 border-primary/20 text-primary font-black uppercase text-[8px] tracking-widest bg-primary/5"><Sparkles className="mr-1.5 h-3 w-3" />AI Synthesis</Button></div>
                                    <FormControl><Textarea rows={8} {...field} className="glass-input" placeholder="Enter bullet points and use AI to synthesize professional copy..." /></FormControl></FormItem>
                            )} />
                            <DialogFooter className="pt-6"><DialogClose asChild><Button type="button" variant="ghost">Abort</Button></DialogClose><Button type="submit" className="rounded-xl px-10 font-black uppercase tracking-widest text-[10px] h-12 shadow-lg shadow-primary/20">Finalize Dissemination</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
          </div>
      </div>

      <Card className="glass-card border-none overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
                <TableRow>
                    <TableHead className="pl-8 uppercase text-[10px] font-black tracking-widest">Headline</TableHead>
                    <TableHead className="uppercase text-[10px] font-black tracking-widest">Audience</TableHead>
                    <TableHead className="uppercase text-[10px] font-black tracking-widest">Transmission Date</TableHead>
                    <TableHead className="text-right pr-8 uppercase text-[10px] font-black tracking-widest">Control Terminal</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? ( [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="pl-8 pr-8"><Skeleton className="h-12 w-full rounded-xl" /></TableCell></TableRow>) ) : announcements && announcements.length > 0 ? (
                announcements.map(announcement => (
                  <TableRow key={announcement.id} className="hover:bg-indigo-50/30 group transition-colors">
                    <TableCell className="pl-8 font-black text-slate-800 uppercase tracking-tight">{announcement.title}</TableCell>
                    <TableCell><Badge variant="secondary" className="rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1">{announcement.targetAudience}</Badge></TableCell>
                    <TableCell className="text-xs font-bold text-slate-400">{announcement.date ? format(announcement.date.toDate(), 'PPP') : '...'}</TableCell>
                    <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white" onClick={() => handleEditClick(announcement)}><Edit className="h-4 w-4 text-indigo-500" /></Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10" onClick={() => handleDelete(announcement.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : ( <TableRow><TableCell colSpan={4} className="h-40 text-center font-bold text-muted-foreground uppercase text-xs opacity-40">No active disseminations found</TableCell></TableRow> )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}