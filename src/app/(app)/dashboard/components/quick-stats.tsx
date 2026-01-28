import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CheckCircle, Percent, Users } from 'lucide-react';

type QuickStatsProps = {
  userRole: 'student' | 'faculty' | 'admin';
};

export default function QuickStats({ userRole }: QuickStatsProps) {
  // In a real app, these stats would come from an API
  const studentStats = [
    { title: 'Enrolled Courses', value: '4', icon: BookOpen },
    { title: 'Overall Attendance', value: '89%', icon: Percent },
    { title: 'Assignments Due', value: '2', icon: CheckCircle },
  ];
  
  const facultyStats = [
    { title: 'Active Courses', value: '3', icon: BookOpen },
    { title: 'Students', value: '128', icon: Users },
    { title: 'Submissions to Grade', value: '15', icon: CheckCircle },
  ];
  
  const adminStats = [
    { title: 'Total Students', value: '2,543', icon: Users },
    { title: 'Total Faculty', value: '189', icon: Users },
    { title: 'Total Courses', value: '350', icon: BookOpen },
  ];

  let stats;
  switch (userRole) {
    case 'faculty':
      stats = facultyStats;
      break;
    case 'admin':
      stats = adminStats;
      break;
    case 'student':
    default:
      stats = studentStats;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
