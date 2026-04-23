'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import { LifeBuoy, PlusCircle, CheckCircle, Sparkles, X, MessageSquareQuote } from 'lucide-react';
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
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { suggestHelpdeskResponse } from '@/ai/flows/suggest-helpdesk-response';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

type HelpdeskTicket = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  category: 'Academics' | 'Technical' | 'Fees' | 'Other';
  subject: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: any;
  resolvedAt?: any;
  resolverComments?: string;
};

const ticketSchema = z.object({
  category: z.enum(['Academics', 'Technical', 'Fees', 'Other']),
  subject: z.string().min(5),
  description: z.string().min(20),
});

const NewTicketForm = () => {
    const { profile: userProfile } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [suggestion, setSuggestion] = useState('');
    const form = useForm<z.infer<typeof ticketSchema>>({ resolver: zodResolver(ticketSchema) });
    const description = useWatch({ control: form.control, name: 'description' });

    useEffect(() => {
        if (description?.length > 25) {
            suggestHelpdeskResponse({ issueDescription: description }).then(r => setSuggestion(r.suggestedResponse)).catch(() => setSuggestion(''));
        }
    }, [description]);

    function onSubmit(values: z.infer<typeof ticketSchema>) {
        if (!firestore || !userProfile) return;
        addDocumentNonBlocking(collection(firestore, 'helpdeskTickets'), {
            studentId: userProfile.id,
            studentName: userProfile.name,
            studentEmail: userProfile.email,
            category: values.category,
            subject: values.subject,
            description: values.description,
            status: 'open',
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Ticket Submitted', description: 'Our support team will review your ticket shortly.' });
        setOpen(false);
        form.reset();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> New Ticket</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Support Ticket</DialogTitle>
                    <DialogDescription>Describe your issue and we'll get back to you as soon as possible.</DialogDescription>
                </DialogHeader>
                <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Academics">Academics</SelectItem><SelectItem value="Technical">Technical</SelectItem><SelectItem value="Fees">Fees</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="subject" render={({ field }) => ( <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} placeholder="Brief subject of the issue" /></FormControl></FormItem> )} />
                    <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={5} {...field} placeholder="Please provide as much detail as possible..." /></FormControl></FormItem> )} />
                    {suggestion && <Alert className="bg-primary/5 border-primary/20"><Sparkles className="h-4 w-4 text-primary" /><AlertTitle className="text-primary font-bold">AI Hint</AlertTitle><AlertDescription className="text-sm">{suggestion}</AlertDescription></Alert>}
                    <DialogFooter><Button type="submit">Submit Ticket</Button></DialogFooter>
                </form></Form>
            </DialogContent>
        </Dialog>
    );
}

export default function HelpdeskPage() {
  const { user, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [viewingTicket, setViewingTicket] = useState<HelpdeskTicket | null>(null);
  const [comment, setComment] = useState('');
  const isFacultyOrAdmin = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return isFacultyOrAdmin ? query(collection(firestore, 'helpdeskTickets'), orderBy('createdAt', 'desc')) : query(collection(firestore, 'helpdeskTickets'), where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user, isFacultyOrAdmin]);
  const { data: tickets, isLoading: areTicketsLoading } = useCollection<HelpdeskTicket>(ticketsQuery);

  const handleResolve = () => {
    if (!firestore || !viewingTicket) return;
    updateDocumentNonBlocking(doc(firestore, 'helpdeskTickets', viewingTicket.id), { status: 'closed', resolvedAt: serverTimestamp(), resolverComments: comment });
    toast({ title: 'Ticket Resolved', description: 'The ticket has been successfully closed.' });
    setViewingTicket(null);
  };

  const isLoading = isUserLoading || areTicketsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Helpdesk</h1>
            <p className="text-muted-foreground">Support requests and technical assistance.</p>
        </div>
        {!isFacultyOrAdmin && <NewTicketForm />}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? ( [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) ) : (
                tickets && tickets.length > 0 ? (
                  tickets.map(ticket => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.subject}</TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell><Badge variant={ticket.status === 'open' ? 'destructive' : 'default'} className="capitalize">{ticket.status}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setViewingTicket(ticket)}>View Details</Button></TableCell>
                    </TableRow>
                  ))
                ) : (
                   <TableRow><TableCell colSpan={4} className="h-24 text-center">No support tickets found.</TableCell></TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!viewingTicket} onOpenChange={o => !o && setViewingTicket(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Ticket Details</DialogTitle>
                <DialogDescription>Viewing full context for the support request.</DialogDescription>
            </DialogHeader>
            {viewingTicket && <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-muted-foreground">Subject</Label>
                    <p className="font-semibold">{viewingTicket.subject}</p>
                </div>
                <div className="space-y-1">
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="bg-muted/50 p-3 rounded-lg text-sm">{viewingTicket.description}</p>
                </div>
                {viewingTicket.status === 'open' && isFacultyOrAdmin && (
                    <div className="space-y-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label>Resolution Comments</Label>
                            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Explain the resolution or next steps..." />
                        </div>
                        <Button className="w-full" onClick={handleResolve}>Resolve & Close Ticket</Button>
                    </div>
                )}
                {viewingTicket.status === 'closed' && viewingTicket.resolverComments && (
                     <div className="space-y-1 border-t pt-4">
                        <Label className="text-muted-foreground">Resolution</Label>
                        <p className="text-sm font-medium">{viewingTicket.resolverComments}</p>
                    </div>
                )}
            </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
