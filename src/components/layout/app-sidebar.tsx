'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  Library,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { loggedInUser } from '@/lib/data';

const studentNavItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
  { href: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { href: '/academics', icon: Library, label: 'Academics' },
  { href: '/results', icon: GraduationCap, label: 'Results' },
  { href: '/engagement', icon: Users, label: 'Engagement' },
];

const facultyNavItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
  { href: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { href: '/academics', icon: Library, label: 'Academics' },
  { href: '/results', icon: GraduationCap, label: 'Results' },
];

const adminNavItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/users', icon: UsersRound, label: 'Users' },
  { href: '/courses', icon: Library, label: 'Courses' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  let navItems = studentNavItems;
  if (loggedInUser.role === 'faculty') {
    navItems = facultyNavItems;
  } else if (loggedInUser.role === 'admin') {
    navItems = adminNavItems;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <TooltipProvider>
            <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
                <Link
                href="#"
                className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
                >
                <BookOpen className="h-4 w-4 transition-all group-hover:scale-110" />
                <span className="sr-only">CampusConnect</span>
                </Link>
                {navItems.map((item) => (
                <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                    <Link
                        href={item.href}
                        className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                        pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground' : ''
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
                ))}
            </nav>
            <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
                <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                    href="/settings"
                    className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                        pathname.startsWith('/settings') ? 'bg-accent text-accent-foreground' : ''
                    )}
                    >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
            </nav>
        </TooltipProvider>
    </aside>
  );
}
