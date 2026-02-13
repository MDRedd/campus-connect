'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, arrayUnion, collection, query, where } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, UserPlus, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';

// Types
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
    const [isJoining, setIsJoining] = useState(false);

    // Fetch Club Details
    const clubDocRef = useMemoFirebase(() => {
        if (!firestore || !clubId) return null;
        return doc(firestore, 'clubs', clubId);
    }, [firestore, clubId]);
    const { data: club, isLoading: isClubLoading } = useDoc<Club>(clubDocRef);

    // Fetch Faculty Details
    const facultyDocRef = useMemoFirebase(() => {
        if (!firestore || !club?.facultyIncharge) return null;
        return doc(firestore, 'users', club.facultyIncharge);
    }, [firestore, club]);
    const { data: faculty, isLoading: isFacultyLoading } = useDoc<UserProfile>(facultyDocRef);

    // Fetch Member Details
    const memberIds = useMemo(() => club?.members || [], [club]);
    const membersQuery = useMemoFirebase(() => {
        if (!firestore || memberIds.length === 0) return null;
        // Firestore 'in' query is limited to 30 items, which is acceptable for this feature.
        return query(collection(firestore, 'users'), where('id', 'in', memberIds.slice(0, 30)));
    }, [firestore, memberIds]);
    const { data: members, isLoading: areMembersLoading } = useCollection<UserProfile>(membersQuery);

    const isMember = useMemo(() => {
        if (!authUser || !club?.members) return false;
        return club.members.includes(authUser.uid);
    }, [authUser, club]);

    const handleJoinClub = () => {
        if (!firestore || !authUser || !club) return;
        setIsJoining(true);
        
        const clubRef = doc(firestore, 'clubs', club.id);
        updateDocumentNonBlocking(clubRef, {
            members: arrayUnion(authUser.uid)
        });

        toast({
            title: "Successfully Joined Club!",
            description: "Welcome! You're now a member.",
        });
    };

    const isLoading = isClubLoading || isFacultyLoading || areMembersLoading;
    
    return (
        <div className="flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engagement
            </Button>
            
            <Card>
                <CardHeader>
                    {isClubLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-9 w-3/4" />
                            <Skeleton className="h-5 w-full" />
                        </div>
                    ) : club ? (
                        <>
                            <CardTitle className="text-3xl">{club.name}</CardTitle>
                            <CardDescription>{club.description}</CardDescription>
                        </>
                    ) : (
                        <CardTitle>Club Not Found</CardTitle>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    {isFacultyLoading ? <Skeleton className="h-10 w-1/2" /> : faculty && (
                        <div>
                            <h3 className="text-sm font-semibold text-muted-foreground">FACULTY IN-CHARGE</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <Avatar className="h-9 w-9">
                                    {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={faculty.name} data-ai-hint="person portrait" />}
                                    <AvatarFallback>{faculty.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{faculty.name}</p>
                                    <p className="text-xs text-muted-foreground">{faculty.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isMember && authUser && (
                        <Button onClick={handleJoinClub} disabled={isJoining}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {isJoining ? 'Joining...' : 'Join Club'}
                        </Button>
                    )}

                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" /> Members ({members?.length ?? 0})</CardTitle>
                    <CardDescription>Students who are part of this club.</CardDescription>
                </CardHeader>
                <CardContent>
                    {areMembersLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                        </div>
                    ) : members && members.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center gap-3 p-2 border rounded-lg">
                                    <Avatar className="h-10 w-10">
                                        {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={member.name} data-ai-hint="person portrait" />}
                                        <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">No members yet. Be the first to join!</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
