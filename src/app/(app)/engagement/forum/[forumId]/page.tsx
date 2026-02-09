'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
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
import { ArrowLeft, Send } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Forum = { title: string; description: string; courseId: string; };
type ForumPost = { userId: string; userName: string; content: string; postedAt: { seconds: number }; };
type UserProfile = { name: string; };

export default function ForumPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: authUser, isUserLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const forumId = params.forumId as string;
  const courseId = searchParams.get('courseId');

  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const userProfileDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileDocRef);

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

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !authUser || !userProfile || !courseId || !forumId || !newPostContent.trim()) return;

    setIsSubmitting(true);
    try {
      const postsColRef = collection(firestore, 'courses', courseId, 'forums', forumId, 'forum_posts');
      await addDoc(postsColRef, {
        forumId,
        userId: authUser.uid,
        userName: userProfile.name,
        content: newPostContent.trim(),
        postedAt: serverTimestamp(),
      });
      setNewPostContent('');
    } catch (error) {
      console.error("Error adding post:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your post.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!courseId) {
    return (
        <div className="flex flex-col gap-6 items-center">
            <Card className="w-full max-w-4xl">
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                    <CardDescription>Course ID is missing. Please go back and try again.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }

  const isLoading = isForumLoading || arePostsLoading || isAuthLoading;

  return (
    <div className="flex flex-col gap-6">
       <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/engagement">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engagement
        </Link>
      </Button>
      <Card className="w-full">
        <CardHeader>
            {isForumLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                </div>
            ) : forum ? (
                <>
                    <CardTitle className="text-3xl">{forum.title}</CardTitle>
                    <CardDescription>{forum.description}</CardDescription>
                </>
            ) : (
                 <CardTitle>Forum not found</CardTitle>
            )}
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
                {isLoading ? (
                    <>
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </>
                ) : posts && posts.length > 0 ? (
                    posts.map(post => (
                        <div key={post.id} className="flex items-start gap-4">
                            <Avatar>
                                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={post.userName} data-ai-hint="person portrait" />}
                                <AvatarFallback>{post.userName.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 rounded-lg border p-4">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{post.userName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {post.postedAt ? format(new Date(post.postedAt.seconds * 1000), 'PPp') : '...'}
                                    </p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">{post.content}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        <p>No posts in this forum yet. Be the first to start the conversation!</p>
                    </div>
                )}
            </div>

            <div className="border-t pt-6">
                <form onSubmit={handlePostSubmit} className="flex flex-col gap-4">
                     <Textarea
                        placeholder="Write your reply..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        disabled={isSubmitting || !authUser}
                    />
                    <Button type="submit" className="w-fit self-end" disabled={isSubmitting || !newPostContent.trim() || !authUser}>
                        {isSubmitting ? 'Posting...' : <> <Send className="mr-2 h-4 w-4" /> Post Reply </>}
                    </Button>
                </form>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
