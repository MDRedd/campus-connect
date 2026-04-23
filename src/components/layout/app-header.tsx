'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Bell,
  PanelLeft,
  Search,
  Check,
  ChevronDown,
  LayoutGrid,
  ShieldCheck,
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
import { Badge } from '@/components/ui/badge';

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
    <header className="sticky top-0 z-40 flex h-20 items-center gap-4 bg-background/80 backdrop-blur-xl border-b border-indigo-50/50 px-6 sm:h-auto sm:border-0 sm:bg-transparent sm:py-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden rounded-xl bg-white border-indigo-100">
            <PanelLeft className="h-5 w-5 text-primary" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0 border-none">
            <MobileSidebarContent />
        </SheetContent>
      </Sheet>
      
      <div className="hidden md:flex items-center gap-3">
         <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/10">
            <LayoutGrid className="h-4 w-4 text-primary" />
         </div>
         <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                <BreadcrumbLink asChild>
                    <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-colors">Node Entry</Link>
                </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="opacity-20" />
                <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] font-black uppercase tracking-widest text-primary">Workspace HUD</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="relative ml-auto flex items-center gap-4">
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-green-500/5 rounded-full border border-green-500/10">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-[8px] font-black uppercase tracking-widest text-green-600/70">Cloud Sync Active</span>
        </div>

        <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
            type="search"
            placeholder="Search academic ledger..."
            className="w-[280px] rounded-xl bg-white/50 border-indigo-50 pl-9 h-11 text-xs font-medium focus:bg-white transition-all shadow-inner"
            />
        </div>
        
        <ThemeToggle />

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl relative bg-white/50 hover:bg-white border border-indigo-50/50 h-11 w-11 shadow-sm group">
                    <Bell className="h-5 w-5 text-slate-600 group-hover:text-primary transition-colors" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96 rounded-2xl border-indigo-50 shadow-2xl overflow-hidden p-0">
                <div className="bg-primary/5 p-4 border-b border-indigo-50/50">
                    <DropdownMenuLabel className="flex justify-between items-center p-0">
                        <span className="text-xs font-black uppercase tracking-widest text-primary">Transmission HUD</span>
                        {unreadCount > 0 && <Badge className="bg-primary text-white text-[9px] font-black rounded-lg">{unreadCount} New</Badge>}
                    </DropdownMenuLabel>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                    {areNotificationsLoading ? (
                        <div className="p-4 space-y-3"><Skeleton className="h-10 w-full rounded-xl"/><Skeleton className="h-10 w-full rounded-xl"/></div>
                    ) : notifications && notifications.length > 0 ? (
                        notifications.map(notification => {
                            const content = (
                                <div className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-indigo-50">
                                    <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", notification.read ? "bg-transparent" : "bg-primary shadow-[0_0_8px_rgba(79,70,229,0.6)]")} />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-xs font-bold leading-snug text-slate-700">{notification.message}</p>
                                        <p className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground opacity-60">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            );

                            return (
                                <DropdownMenuItem key={notification.id} asChild className="p-0 focus:bg-transparent">
                                    {notification.link ? (
                                        <Link href={notification.link}>{content}</Link>
                                    ) : <div>{content}</div>}
                                </DropdownMenuItem>
                            )
                        })
                    ) : (
                        <div className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground py-10 opacity-30">No active transmissions</div>
                    )}
                </div>
                {notifications && notifications.length > 0 && (
                    <div className="p-2 border-t border-indigo-50/50 bg-slate-50/50">
                        <DropdownMenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0} className="rounded-xl justify-center font-black uppercase text-[9px] tracking-widest h-10 cursor-pointer">
                            <Check className="mr-2 h-3.5 w-3.5" /> Synchronize All as Read
                        </DropdownMenuItem>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="outline" className="overflow-hidden rounded-xl h-11 px-3 bg-white/50 border-indigo-50 hover:bg-white hover:border-primary/20 transition-all shadow-sm group">
                {userProfile && userAvatar ? (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 border border-indigo-100 group-hover:scale-110 transition-transform">
                            <AvatarImage src={userAvatar.imageUrl} alt={userProfile.name} />
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{userInitials}</AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-slate-700">{userProfile.name.split(' ')[0]}</span>
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                    </div>
                ) : <Skeleton className="h-7 w-7 rounded-full" />}
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-indigo-50 shadow-2xl p-2 mt-2">
                <div className="px-3 py-3 mb-2 bg-slate-50/50 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{userProfile?.role.replace('-', ' ')} Tier</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{userProfile?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-indigo-50/50" />
                <DropdownMenuItem asChild className="rounded-xl font-bold uppercase text-[9px] tracking-widest h-10 cursor-pointer">
                    <Link href="/profile">Identity Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl font-bold uppercase text-[9px] tracking-widest h-10 cursor-pointer">
                    <Link href="/settings">System Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-indigo-50/50" />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-xl font-black uppercase text-[9px] tracking-widest h-10 text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer">
                    Terminate Session
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
