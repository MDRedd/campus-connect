
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
  category: z.enum(['Academics', 'Technical', 'Fees', 'Other'], {
    required_error: 'Please select a category.',
  }),
  subject: z.string().min(5, 'Subject must be at least 5 characters long.'),
  description: z.string().min(20, 'Please provide a detailed description.'),
});

// Custom hook for debouncing
function useDebounce(value: string, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// New component for the ticket creation form
const NewTicketForm = () => {
    const { user: authUser, profile: userProfile } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [openNewTicketDialog, setOpenNewTicketDialog] = useState(false);

    const [suggestion, setSuggestion] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);

    const form = useForm<z.infer<typeof ticketSchema>>({
        resolver: zodResolver(ticketSchema),
        defaultValues: {
          subject: '',
          description: '',
        },
    });

    const descriptionValue = useWatch({
        control: form.control,
        name: 'description',
    });

    const debouncedDescription = useDebounce(descriptionValue, 750);

    useEffect(() => {
        if (debouncedDescription && debouncedDescription.length > 25) {
            const getSuggestion = async () => {
                setIsSuggesting(true);
                try {
                    const result = await suggestHelpdeskResponse({ issueDescription: debouncedDescription });
                    if (result.suggestedResponse) {
                        setSuggestion(result.suggestedResponse);
                    }
                } catch (e) {
                    console.error("Error getting AI suggestion:", e);
                    // Don't show an error to the user, just fail silently.
                    setSuggestion('');
                } finally {
                    setIsSuggesting(false);
                }
            };
            getSuggestion();
        } else {
            setSuggestion('');
        }
    }, [debouncedDescription]);

    function onNewTicketSubmit(values: z.infer<typeof ticketSchema>) {
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
    
        toast({
            title: 'Ticket Submitted',
            description: 'Your request has been sent to the support team.',
        });
        setOpenNewTicketDialog(false);
        form.reset();
        setSuggestion('');
    }

    return (
        <Dialog open={openNewTicketDialog} onOpenChange={(isOpen) => {
            setOpenNewTicketDialog(isOpen);
            if (!isOpen) {
                form.reset();
                setSuggestion('');
            }
        }}>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Create a New Support Ticket</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onNewTicketSubmit)} className="space-y-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Academics">Academics</SelectItem>
                                    <SelectItem value="Technical">Technical</SelectItem>
                                    <SelectItem value="Fees">Fees</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="subject" render={({ field }) => ( <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={5} {...field} placeholder="Please describe your issue in detail..." /></FormControl><FormMessage /></FormItem> )} />
                        
                        {(isSuggesting || suggestion) && (
                            <Alert>
                                <Sparkles className="h-4 w-4" />
                                <AlertTitle className="flex justify-between items-center">
                                    <span>AI Assistant</span>
                                    {suggestion && !isSuggesting && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSuggestion('')}><X className="h-4 w-4" /></Button>}
                                </AlertTitle>
                                <AlertDescription>
                                    {isSuggesting ? 'Thinking...' : suggestion}
                                </AlertDescription>
                            </Alert>
                        )}

                        <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={form.formState.isSubmitting}>Submit Ticket</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function HelpdeskPage() {
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [viewingTicket, setViewingTicket] = useState<HelpdeskTicket | null>(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);

  const isFacultyOrAdmin = userProfile?.role === 'faculty' || userProfile?.role.includes('admin');

  const ticketsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;

    if (isFacultyOrAdmin) {
      // Faculty/Admins see all tickets
      return query(collection(firestore, 'helpdeskTickets'), orderBy('createdAt', 'desc'));
    } else {
      // Students see only their own tickets
      return query(collection(firestore, 'helpdeskTickets'), where('studentId', '==', authUser.uid), orderBy('createdAt', 'desc'));
    }
  }, [firestore, authUser, isFacultyOrAdmin]);
  const { data: tickets, isLoading: areTicketsLoading } = useCollection<HelpdeskTicket>(ticketsQuery);

  useEffect(() => {
    if (viewingTicket && viewingTicket.status === 'open') {
        const getSuggestion = async () => {
            setIsGeneratingSuggestion(true);
            setAiSuggestion('');
            try {
                const result = await suggestHelpdeskResponse({ issueDescription: viewingTicket.description });
                setAiSuggestion(result.suggestedResponse);
            } catch (e) {
                console.error("Error generating admin suggestion:", e);
                setAiSuggestion(''); // Clear on error
            } finally {
                setIsGeneratingSuggestion(false);
            }
        };
        getSuggestion();
    } else {
        setAiSuggestion('');
    }
  }, [viewingTicket]);

  const handleConfirmResolution = () => {
    if (!firestore || !authUser || !viewingTicket) return;

    const ticketRef = doc(firestore, 'helpdeskTickets', viewingTicket.id);
    updateDocumentNonBlocking(ticketRef, {
        status: 'closed',
        resolvedAt: serverTimestamp(),
        resolvedBy: authUser.uid,
        resolverComments: resolutionComment,
    });
    
    toast({
        title: 'Ticket Closed',
        description: 'The ticket has been marked as resolved.',
    });
    
    setViewingTicket(null);
    setResolutionComment('');
  };
  
  const getStatusVariant = (status: 'open' | 'closed') => {
      return status === 'open' ? 'destructive' : 'default';
  }

  const isLoading = isUserLoading || areTicketsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Helpdesk</h1>
        <p className="text-muted-foreground">
          {isFacultyOrAdmin ? 'Review and resolve student support tickets.' : 'Submit and track your support tickets.'}
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>{isFacultyOrAdmin ? 'All submitted tickets.' : 'Your submitted tickets.'}</CardDescription>
          </div>
          {!isFacultyOrAdmin && <NewTicketForm />}
        </CardHeader>
        <CardContent>
          {isFacultyOrAdmin ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10" /></TableCell></TableRow>)
                  ) : tickets && tickets.length > 0 ? (
                    tickets.map(ticket => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <Link href={`/users/${ticket.studentId}`} className="font-medium hover:underline">
                            {ticket.studentName}
                          </Link>
                          <div className="text-sm text-muted-foreground">{ticket.studentEmail}</div>
                        </TableCell>
                        <TableCell>
                            <Button variant="link" className="p-0 h-auto font-normal text-left whitespace-normal" onClick={() => setViewingTicket(ticket)}>
                                {ticket.subject}
                            </Button>
                        </TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>{ticket.createdAt ? format(ticket.createdAt.toDate(), 'PP') : '...'}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setViewingTicket(ticket)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No tickets found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <Dialog open={!!viewingTicket} onOpenChange={(open) => {
                  if (!open) {
                      setViewingTicket(null);
                      setResolutionComment('');
                      setAiSuggestion('');
                      setIsGeneratingSuggestion(false);
                  }
              }}>
                  <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                          <DialogTitle>Ticket Details</DialogTitle>
                          <DialogDescription>
                              Review the student's issue and provide a resolution.
                          </DialogDescription>
                      </DialogHeader>
                      {viewingTicket && (
                        <div className="py-4 space-y-6">
                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right text-muted-foreground pt-1">Student</Label>
                                    <p className="col-span-3 font-semibold">{viewingTicket.studentName} <span className="font-normal text-muted-foreground">({viewingTicket.studentEmail})</span></p>
                                </div>
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right text-muted-foreground pt-1">Subject</Label>
                                    <p className="col-span-3">{viewingTicket.subject}</p>
                                </div>
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right text-muted-foreground pt-1">Description</Label>
                                    <p className="col-span-3 bg-muted p-3 rounded-md whitespace-pre-wrap">{viewingTicket.description}</p>
                                </div>
                            </div>
                            {viewingTicket.status === 'open' ? (
                                <div className="space-y-4">
                                    {(isGeneratingSuggestion || aiSuggestion) && (
                                        <Alert>
                                            <Sparkles className="h-4 w-4" />
                                            <AlertTitle>Suggested Response</AlertTitle>
                                            <AlertDescription className="space-y-2">
                                                {isGeneratingSuggestion ? 'Generating suggestion...' : (
                                                    <>
                                                        <p>{aiSuggestion}</p>
                                                        <Button size="sm" variant="outline" onClick={() => setResolutionComment(aiSuggestion)}>
                                                            <MessageSquareQuote className="mr-2 h-4 w-4" /> Use Suggestion
                                                        </Button>
                                                    </>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="resolution-comment">Resolution Comment</Label>
                                        <Textarea id="resolution-comment" value={resolutionComment} onChange={e => setResolutionComment(e.target.value)} placeholder="Provide a helpful response for the student..." />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Resolution</Label>
                                     <Alert variant="default" className="w-full bg-background">
                                        <MessageSquareQuote className="h-4 w-4" />
                                        <AlertTitle>Resolution Comment</AlertTitle>
                                        <AlertDescription>
                                            {viewingTicket.resolverComments || "No comment was provided."}
                                        </AlertDescription>
                                    </Alert>
                                    <p className="text-xs text-muted-foreground text-right">
                                        Resolved on {viewingTicket.resolvedAt ? format(viewingTicket.resolvedAt.toDate(), 'PPP') : 'N/A'}
                                    </p>
                                </div>
                            )}
                        </div>
                      )}
                      <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                          {viewingTicket?.status === 'open' && (
                            <Button onClick={handleConfirmResolution}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Close Ticket
                            </Button>
                          )}
                      </DialogFooter>
                  </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : tickets && tickets.length > 0 ? (
                tickets.map(ticket => (
                  <Card key={ticket.id}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                            <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                        </div>
                      <CardDescription>
                        Category: {ticket.category} | Submitted on: {ticket.createdAt ? format(ticket.createdAt.toDate(), 'PPP') : '...'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{ticket.description}</p>
                    </CardContent>
                    {ticket.status === 'closed' && ticket.resolvedAt && (
                      <CardFooter className="flex flex-col items-start gap-2 border-t pt-4 bg-muted/50">
                         <p className="text-sm font-semibold">Resolution</p>
                         <p className="text-sm text-muted-foreground">
                            Closed on {format(ticket.resolvedAt.toDate(), 'PPP')}
                         </p>
                         {ticket.resolverComments && (
                            <Alert variant="default" className="w-full bg-background">
                                <MessageSquareQuote className="h-4 w-4" />
                                <AlertTitle>Admin Comment</AlertTitle>
                                <AlertDescription>
                                    {ticket.resolverComments}
                                </AlertDescription>
                            </Alert>
                         )}
                      </CardFooter>
                    )}
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                  <LifeBuoy className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No Tickets Found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">You haven't submitted any support tickets yet.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
