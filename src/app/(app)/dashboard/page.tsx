import { loggedInUser, studentTimetable, announcements, attendance, courses } from '@/lib/data';
import WelcomeBanner from './components/welcome-banner';
import QuickStats from './components/quick-stats';
import UpcomingClasses from './components/upcoming-classes';
import AttendanceChart from './components/attendance-chart';
import RecentAnnouncements from './components/recent-announcements';

export default function DashboardPage() {
  const attendanceData = attendance.map(att => {
    const course = courses.find(c => c.id === att.courseId);
    return {
      name: course?.code || 'N/A',
      attended: att.attendedClasses,
      total: att.totalClasses,
      percentage: Math.round((att.attendedClasses / att.totalClasses) * 100),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner user={loggedInUser} />
      <QuickStats userRole={loggedInUser.role} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingClasses timetable={studentTimetable} />
        </div>
        <AttendanceChart data={attendanceData} />
      </div>
      <RecentAnnouncements announcements={announcements} />
    </div>
  );
}
