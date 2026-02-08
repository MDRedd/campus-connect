import type { ImagePlaceholder } from './placeholder-images';
import { PlaceHolderImages } from './placeholder-images';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  avatar: ImagePlaceholder;
  department?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  credits: number;
}

export interface TimetableEntry {
  id: string;
  course: Course;
  facultyName: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface AttendanceRecord {
  courseId: string;
  totalClasses: number;
  attendedClasses: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

export const studentUser: User = {
  id: 'user-1',
  name: 'Alex Johnson',
  email: 'alex.j@example.com',
  role: 'student',
  avatar: PlaceHolderImages.find(img => img.id === 'user-avatar-1')!,
  department: 'Computer Science',
};

export const facultyUser: User = {
  id: 'user-2',
  name: 'Dr. Evelyn Reed',
  email: 'e.reed@example.com',
  role: 'faculty',
  avatar: PlaceHolderImages.find(img => img.id === 'user-avatar-2')!,
  department: 'Computer Science',
};

export const adminUser: User = {
  id: 'user-3',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  avatar: PlaceHolderImages.find(img => img.id === 'user-avatar-2')!,
};

export const courses: Course[] = [
  { id: 'cs101', name: 'Introduction to Programming', code: 'CS101', credits: 3 },
  { id: 'ma202', name: 'Linear Algebra', code: 'MA202', credits: 4 },
  { id: 'ph100', name: 'Modern Physics', code: 'PH100', credits: 3 },
  { id: 'ds301', name: 'Data Structures', code: 'DS301', credits: 4 },
];

export const studentTimetable: TimetableEntry[] = [
  { id: 'tt1', course: courses[0], facultyName: 'Dr. Alan Turing', day: 'Monday', startTime: '10:00', endTime: '11:00', room: 'A-101' },
  { id: 'tt2', course: courses[1], facultyName: 'Dr. Ada Lovelace', day: 'Monday', startTime: '11:00', endTime: '12:00', room: 'B-203' },
  { id: 'tt3', course: courses[3], facultyName: 'Dr. Grace Hopper', day: 'Tuesday', startTime: '09:00', endTime: '10:30', room: 'Lab-3' },
  { id: 'tt4', course: courses[2], facultyName: 'Dr. Marie Curie', day: 'Wednesday', startTime: '14:00', endTime: '15:00', room: 'C-301' },
];

export const facultyTimetable: TimetableEntry[] = [
    { id: 'tt3', course: courses[3], facultyName: 'Dr. Grace Hopper', day: 'Tuesday', startTime: '09:00', endTime: '10:30', room: 'Lab-3' },
    { id: 'tt5', course: courses[0], facultyName: 'Dr. Grace Hopper', day: 'Thursday', startTime: '10:00', endTime: '11:00', room: 'A-101' },
];

export const attendance: AttendanceRecord[] = [
  { courseId: 'cs101', totalClasses: 20, attendedClasses: 18 },
  { courseId: 'ma202', totalClasses: 25, attendedClasses: 22 },
  { courseId: 'ph100', totalClasses: 18, attendedClasses: 15 },
  { courseId: 'ds301', totalClasses: 22, attendedClasses: 21 },
];

export const announcements: Announcement[] = [
  { id: 'an1', title: 'Mid-term Exam Schedule Update', content: 'The mid-term exam schedule for the 3rd semester has been updated. Please check the examination portal.', date: '2023-10-25' },
  { id: 'an2', title: 'Annual Tech Fest "Innovate 2023"', content: 'Get ready for the biggest tech fest of the year! Registrations open on Nov 1st.', date: '2023-10-24' },
  { id: 'an3', title: 'Library Closure for Maintenance', content: 'The central library will be closed this weekend for annual maintenance.', date: '2023-10-22' },
];
