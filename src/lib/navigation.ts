'use client';

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
    CreditCard,
    LifeBuoy,
  } from 'lucide-react';

type UserRole = 'student' | 'faculty' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';

const studentNavItems = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
    { href: '/attendance', icon: ClipboardList, label: 'Attendance' },
    { href: '/academics', icon: Library, label: 'Academics' },
    { href: '/courses', icon: BookCopy, label: 'Course Catalog' },
    { href: '/results', icon: GraduationCap, label: 'Results' },
    { href: '/engagement', icon: Users, label: 'Engagement' },
    { href: '/fees', icon: CreditCard, label: 'Fees' },
    { href: '/helpdesk', icon: LifeBuoy, label: 'Helpdesk' },
];

const facultyNavItems = [
    { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
    { href: '/attendance', icon: ClipboardList, label: 'Attendance Dashboard' },
    { href: '/academics', icon: Library, label: 'Academics' },
    { href: '/results', icon: GraduationCap, label: 'Results' },
    { href: '/engagement', icon: Users, label: 'Engagement' },
    { href: '/announcements', icon: Megaphone, label: 'Announcements' },
    { href: '/helpdesk', icon: LifeBuoy, label: 'Helpdesk' },
];

export const getNavItems = (role: UserRole) => {
    if (role === 'student') {
        return studentNavItems;
    }
    if (role === 'faculty') {
        return facultyNavItems;
    }

    // Handle all admin roles
    const items = [
        { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
    ];

    if (role === 'super-admin' || role === 'user-admin') {
        items.push({ href: '/users', icon: UsersRound, label: 'Users' });
    }
    if (role === 'super-admin' || role === 'course-admin') {
        items.push({ href: '/courses', icon: Library, label: 'Course Management' });
    }
    if (role === 'super-admin' || role === 'attendance-admin') {
        items.push({ href: '/attendance', icon: ClipboardList, label: 'Attendance Dashboard' });
    }
    
    // All admins can make announcements
    items.push({ href: '/announcements', icon: Megaphone, label: 'Announcements' });
    items.push({ href: '/engagement', icon: Users, label: 'Engagement' });
    items.push({ href: '/helpdesk', icon: LifeBuoy, label: 'Helpdesk' });

    // A super-admin gets all faculty privileges as well, for simplicity.
    if (role === 'super-admin') {
        items.push(
            ...[
                { href: '/timetable', icon: CalendarCheck, label: 'Timetable' },
                { href: '/academics', icon: Library, label: 'Academics' },
                { href: '/results', icon: GraduationCap, label: 'Results' },
            ]
        );
    }
    
    return items;
}
