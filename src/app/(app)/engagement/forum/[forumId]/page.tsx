
'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useDoc } from '@/firebase';
import { doc, collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, MessageSquare, Zap, Clock, ShieldCheck } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Forum = { title: string; description: string; courseId: string; };
type ForumPost = { id: string; userId: string; userName: string; content: string; postedAt: any; };

export default function ForumPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: authUser, profile: userProfile, isUserLoading } = useUser();

  const forumId = params.forumId as string;
  const courseId = searchParams.get('courseId');

  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const forumDocRef = useMemoFirebase(() => {
    if (!firestore || !courseId || !forumId) return null;
    return doc(firestore, 'courses', courseId, 'forums', forumId);
  }, [firestore, courseId, forumId]);
  const { data: forum, isLoading: isForumLoading } = useDoc<Forum>(forumDocRef);

  const postsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || !forumId) return null;
    return query(collection(firestore, 'courses', courseId, 'forums', forumId, 'forum_posts'), orderBy('postedAt', 'asc'));
  }, [firestore, courseId, forumId]);
  const { data: posts, isLoading: arePostsLoading } = useCollection<ForumPost>(postsQuery);

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !authUser || !userProfile || !courseId || !forumId || !newPostContent.trim()) return;

    setIsSubmitting(true);
    const postsColRef = collection(firestore, 'courses', courseId, 'forums', forumId, 'forum_posts');
    addDocumentNonBlocking(postsColRef, {
      forumId,
      userId: authUser.uid,
      userName: userProfile.name,
      content: newPostContent.trim(),
      postedAt: serverTimestamp(),
    });
    
    setNewPostContent('');
    setIsSubmitting(false);
  };

  if (!courseId) {
    return <div className="p-12 text-center uppercase font-black text-xs opacity-40">Environmental Error: Module context missing.</div>
  }

  const isLoading = isForumLoading || arePostsLoading || isUserLoading;

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-700">
       <div className="academic-hero">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl" onClick={() => router.back()}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Academic Collective
                  </Button>
                  <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">
                          <MessageSquare className="h-3 w-3" /> Knowledge Exchange
                      </div>
                      <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                        {isForumLoading ? <Skeleton className="h-12 w-80" /> : forum?.title}
                      </h1>
                      <p className="text-indigo-100/70 font-medium max-w-2xl">{forum?.description}</p>
                  </div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] flex flex-col items-center gap-2 text-white">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Discourse</span>
                  <span className="text-5xl font-black tracking-tighter">{posts?.length ?? 0}</span>
                  <span className="text-[9px] font-bold opacity-60 uppercase">System Contributions</span>
              </div>
          </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 scroll-smooth">
                {isLoading ? (
                    <>
                        <Skeleton className="h-24 w-full rounded-3xl" />
                        <Skeleton className="h-32 w-full rounded-3xl" />
                    </>
                ) : posts && posts.length > 0 ? (
                    posts.map(post => (
                        <div key={post.id} className="flex items-start gap-4 animate-in slide-in-from-bottom-4 duration-500">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm mt-1">
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={post.userName} />}
                                <AvatarFallback className="font-black text-[10px] uppercase bg-primary/5 text-primary">{post.userName.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 rounded-[2rem] border bg-white/40 p-6 group hover:bg-white hover:shadow-xl transition-all border-indigo-50/50">
                                <div className="flex justify-between items-center mb-3">
                                    <Link href={`/users/${post.userId}`} className="text-xs font-black text-slate-800 uppercase tracking-widest hover:underline">
                                        {post.userName}
                                    </Link>
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter text-muted-foreground opacity-60">
                                        <Clock className="h-3 w-3" />
                                        {post.postedAt ? format(new Date(post.postedAt.seconds * 1000), 'Pp') : '...'}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">{post.content}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 opacity-20 uppercase font-black tracking-widest text-xs">No entries in current thread</div>
                )}
            </div>

            <div className="glass-card border-none p-8 mt-4">
                <form onSubmit={handlePostSubmit} className="flex flex-col gap-6">
                    <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Draft Response</Label>
                         <Textarea
                            placeholder="Contribute to the academic discourse..."
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            disabled={isSubmitting || !authUser}
                            className="min-h-[120px] rounded-2xl bg-white shadow-inner focus:ring-primary border-indigo-100"
                        />
                    </div>
                    <Button type="submit" className="w-fit self-end rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" disabled={isSubmitting || !newPostContent.trim() || !authUser}>
                        {isSubmitting ? 'Transmitting...' : <> <Send className="mr-2 h-4 w-4" /> Authorize & Post </>}
                    </Button>
                </form>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
            <Card className="glass-card border-none bg-indigo-50/50">
                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Discourse Rules</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Maintain academic integrity and professional conduct in all communications.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">Responses are synchronized in real-time across the institutional ledger.</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-none">
                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Moderation Index</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-[10px] font-medium text-slate-400 leading-relaxed uppercase tracking-wider">All entries are subject to automated content screening and faculty audit. Violations of code of conduct will be flagged to the Registrar.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
