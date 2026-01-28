import {
    CalendarCheck,
    ClipboardList,
    GraduationCap,
    LayoutGrid,
    Library,
    Users,
    UsersRound,
  } from 'lucide-react';
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

export const getNavItems = () => {
    if (loggedInUser.role === 'faculty') {
        return facultyNavItems;
    } else if (loggedInUser.role === 'admin') {
        return adminNavItems;
    }
    return studentNavItems;
}
