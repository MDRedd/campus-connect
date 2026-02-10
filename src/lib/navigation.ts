import {
    CalendarCheck,
    ClipboardList,
    GraduationCap,
    LayoutGrid,
    Library,
    Users,
    UsersRound,
    QrCode,
    BookCopy,
    Megaphone,
  } from 'lucide-react';

type UserRole = 'student' | 'faculty' | 'admin';

const studentNavItems = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
    { href: '/attendance', icon: ClipboardList, label: 'Attendance' },
    { href: '/academics', icon: Library, label: 'Academics' },
    { href: '/courses', icon: BookCopy, label: 'Course Catalog' },
    { href: '/results', icon: GraduationCap, label: 'Results' },
    { href: '/engagement', icon: Users, label: 'Engagement' },
    { href: '/announcements/view', icon: Megaphone, label: 'Announcements' },
];

const facultyNavItems = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
    { href: '/attendance', icon: ClipboardList, label: 'Attendance Dashboard' },
    { href: '/attendance/mark', icon: QrCode, label: 'Mark Attendance' },
    { href: '/academics', icon: Library, label: 'Academics' },
    { href: '/results', icon: GraduationCap, label: 'Results' },
    { href: '/announcements', icon: Megaphone, label: 'Announcements' },
];

const adminNavItems = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { href: '/users', icon: UsersRound, label: 'Users' },
    { href: '/courses', icon: Library, label: 'Course Management' },
    { href: '/announcements', icon: Megaphone, label: 'Announcements' },
];

export const getNavItems = (role: UserRole) => {
    switch (role) {
        case 'faculty':
            return facultyNavItems;
        case 'admin':
            return adminNavItems;
        case 'student':
        default:
            return studentNavItems;
    }
}
