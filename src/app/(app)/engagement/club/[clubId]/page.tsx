'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, arrayUnion, arrayRemove, collection, query, where } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, UserPlus, Users, UserMinus, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type Club = { id: string; name: string; description: string; facultyIncharge: string; members?: string[]; };
type UserProfile = { id: string; name: string; email: string; };

export default function ClubDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { toast } = useToast();
    const clubId = params.clubId as string;
    const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');
    const clubHeaderImage = PlaceHolderImages.find((img) => img.id === 'club-activity');
    const [isUpdatingMembership, setIsUpdatingMembership] = useState(false);

    const clubDocRef = useMemoFirebase(() => {
        if (!firestore || !clubId) return null;
        return doc(firestore, 'clubs', clubId);
    }, [firestore, clubId]);
    const { data: club, isLoading: isClubLoading } = useDoc<Club>(clubDocRef);

    const facultyDocRef = useMemoFirebase(() => {
        if (!firestore || !club?.facultyIncharge) return null;
        return doc(firestore, 'users', club.facultyIncharge);
    }, [firestore, club]);
    const { data: faculty, isLoading: isFacultyLoading } = useDoc<UserProfile>(facultyDocRef);

    const memberIds = useMemo(() => club?.members || [], [club]);
    const membersQuery = useMemoFirebase(() => {
        if (!firestore || memberIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('id', 'in', memberIds.slice(0, 30)));
    }, [firestore, memberIds]);
    const { data: members, isLoading: areMembersLoading } = useCollection<UserProfile>(membersQuery);

    const isMember = useMemo(() => {
        if (!authUser || !club?.members) return false;
        return club.members.includes(authUser.uid);
    }, [authUser, club]);

    const handleJoinClub = () => {
        if (!firestore || !authUser || !club) return;
        setIsUpdatingMembership(true);
        updateDocumentNonBlocking(doc(firestore, 'clubs', club.id), { members: arrayUnion(authUser.uid) });
        toast({ title: "Guild Access Granted", description: "You are now an authorized member of this organization." });
        setIsUpdatingMembership(false);
    };

    const handleLeaveClub = () => {
        if (!firestore || !authUser || !club) return;
        if (!confirm("Confirm guild excision? This will terminate your membership status.")) return;
        setIsUpdatingMembership(true);
        updateDocumentNonBlocking(doc(firestore, 'clubs', club.id), { members: arrayRemove(authUser.uid) });
        toast({ title: "Membership Terminated", description: "You have successfully withdrawn from the organization." });
        setIsUpdatingMembership(false);
    };

    const isLoading = isClubLoading || isFacultyLoading || areMembersLoading;
    
    return (
        <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
             <div className="academic-hero relative min-h-[300px] flex items-end">
                {clubHeaderImage && <Image src={clubHeaderImage.imageUrl} alt="Club" fill className="object-cover opacity-20" priority data-ai-hint={clubHeaderImage.imageHint} />}
                <div className="relative z-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6 p-2">
                    <div className="space-y-4">
                        <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Guild Directory
                        </Button>
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                                <Globe className="h-3 w-3" /> Collective Identity
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                                {isClubLoading ? <Skeleton className="h-14 w-80" /> : club?.name}
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 shrink-0">
                         {authUser && (
                            isMember ? (
                                <Button variant="outline" className="h-12 px-8 rounded-xl border-white/20 text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px] backdrop-blur-md" onClick={handleLeaveClub} disabled={isUpdatingMembership}>
                                    <UserMinus className="mr-2 h-4 w-4 text-red-400" />
                                    {isUpdatingMembership ? 'Processing...' : 'Withdraw Membership'}
                                </Button>
                            ) : (
                                <Button className="h-12 px-10 rounded-xl bg-white text-primary hover:bg-indigo-50 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-black/30" onClick={handleJoinClub} disabled={isUpdatingMembership}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    {isUpdatingMembership ? 'Processing...' : 'Authorize Access'}
                                </Button>
                            )
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-8">
                    <Card className="glass-card border-none">
                        <CardHeader><CardTitle className="text-xl font-black uppercase tracking-tight">Mission Statement</CardTitle></CardHeader>
                        <CardContent>
                             {isClubLoading ? <Skeleton className="h-24 w-full" /> : (
                                <p className="text-slate-600 leading-relaxed font-medium">{club?.description}</p>
                             )}
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Active Guild Roster</CardTitle>
                            <Badge variant="secondary" className="font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-lg bg-primary/5 text-primary border-primary/10">
                                <Users className="mr-1.5 h-3 w-3 inline" /> {members?.length ?? 0} Verified
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {areMembersLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                                </div>
                            ) : members && members.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {members.map(member => (
                                        <div key={member.id} className="flex items-center gap-4 p-4 bg-white/40 rounded-2xl border border-white hover:bg-white/80 transition-all group">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={member.name} />}
                                                <AvatarFallback className="font-black text-xs uppercase bg-primary/5 text-primary">{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <Link href={`/users/${member.id}`} className="font-black text-slate-800 uppercase tracking-tight truncate block hover:text-primary transition-colors">
                                                    {member.name}
                                                </Link>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{member.email.split('@')[0]}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">Awaiting first guild enrollment</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <Card className="glass-card border-none bg-indigo-50/50">
                        <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Guild Sponsorship</CardTitle></CardHeader>
                        <CardContent>
                            {isFacultyLoading ? <Skeleton className="h-20 w-full rounded-2xl" /> : faculty && (
                                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                                    <Avatar className="h-12 w-12 border-2 border-indigo-50 shadow-inner">
                                        {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={faculty.name} />}
                                        <AvatarFallback className="font-black text-xs uppercase bg-primary/5 text-primary">{faculty.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{faculty.name}</p>
                                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Faculty Advisor</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-none">
                        <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Operational Protocol</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Attendance at bi-weekly guild symposiums is mandatory for maintaining active standing.</p>
                            </div>
                             <div className="flex items-start gap-3">
                                <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                                <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Members receive priority access to specialized departmental workshops.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
