'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavItems } from '@/lib/navigation';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export default function MobileSidebarContent() {
  const pathname = usePathname();
  const { profile: userProfile, isUserLoading } = useUser();

  const navItems = userProfile ? getNavItems(userProfile.role) : [];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-6 w-6" />
          <span>DigiCampus</span>
        </Link>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {isUserLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
            </div>
          )}
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                pathname.startsWith(item.href) && 'text-primary bg-muted'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
       <div className="mt-auto p-4">
            <Link
                href="/settings"
                className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    pathname.startsWith('/settings') && 'text-primary bg-muted'
                )}
            >
                <Settings className="h-4 w-4" />
                Settings
            </Link>
       </div>
    </div>
  );
}
