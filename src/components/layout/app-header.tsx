'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Bell,
  PanelLeft,
  Search,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import MobileSidebarContent from './mobile-sidebar-content';
import { useAuth, useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
};

export default function AppHeader() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user: authUser, profile: userProfile } = useUser();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return query(collection(firestore, 'users', authUser.uid, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore, authUser]);
  const { data: notifications, isLoading: areNotificationsLoading } = useCollection<Notification>(notificationsQuery);

  const unreadCount = useMemo(() => {
    return notifications?.filter(n => !n.read).length ?? 0;
  }, [notifications]);

  const userInitials = userProfile?.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!firestore || !authUser || !notifications) return;
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach(notification => {
        const notifRef = doc(firestore, 'users', authUser.uid, 'notifications', notification.id);
        batch.update(notifRef, { read: true });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Error marking notifications as read:", error);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
            <MobileSidebarContent />
        </SheetContent>
      </Sheet>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative ml-auto flex-1 md:grow-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
        />
      </div>
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                )}
                <span className="sr-only">Notifications</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 md:w-96">
            <DropdownMenuLabel className="flex justify-between items-center">
                <span>Notifications</span>
                {unreadCount > 0 && <span className="text-xs font-normal text-muted-foreground">{unreadCount} unread</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
                {areNotificationsLoading ? (
                    <DropdownMenuItem disabled>
                        <Skeleton className="h-10 w-full"/>
                    </DropdownMenuItem>
                ) : notifications && notifications.length > 0 ? (
                    notifications.map(notification => {
                        const content = (
                            <>
                                <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", notification.read ? "bg-transparent" : "bg-primary")} />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm leading-snug">{notification.message}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </>
                        );

                        if (notification.link) {
                            return (
                                <Link href={notification.link} key={notification.id} passHref legacyBehavior>
                                    <DropdownMenuItem as="a" className="items-start gap-3 whitespace-normal cursor-pointer">
                                        {content}
                                    </DropdownMenuItem>
                                </Link>
                            )
                        }

                        return (
                            <DropdownMenuItem key={notification.id} className="items-start gap-3 whitespace-normal">
                                {content}
                            </DropdownMenuItem>
                        )
                    })
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-4">No notifications yet.</div>
                )}
            </div>
            {notifications && notifications.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                <Check className="mr-2 h-4 w-4" />
                <span>Mark all as read</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
            {userProfile && userAvatar ? (
                <Avatar className="h-8 w-8">
                <AvatarImage
                    src={userAvatar.imageUrl}
                    alt={userProfile.name}
                    data-ai-hint={userAvatar.imageHint}
                />
                <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
            ) : (
                <Skeleton className="h-8 w-8 rounded-full" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userProfile ? userProfile.name : 'My Account'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem>Support</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
