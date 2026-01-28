import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { courses, studentTimetable } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { BookCopy, FileText, Download } from 'lucide-react';

const getFacultyForCourse = (courseId: string) => {
  const entry = studentTimetable.find((t) => t.course.id === courseId);
  return entry ? entry.facultyName : 'N/A';
};

export default function AcademicsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academics</h1>
        <p className="text-muted-foreground">
          Manage your courses, assignments, and study materials.
        </p>
      </div>
      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
        </TabsList>
        <TabsContent value="courses" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-lg">
                      <BookCopy className="h-6 w-6" />
                    </div>
                    <span className="flex-1">{course.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {course.code} | {course.credits} Credits
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    Faculty: {getFacultyForCourse(course.id)}
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button size="sm">View Details</Button>
                  <Button size="sm" variant="outline">
                    Go to Course
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="assignments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Assignments</CardTitle>
              <CardDescription>
                Submit your work before the deadline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Assignments... Yet!</h3>
                <p className="mt-1 text-sm text-muted-foreground">This section is under construction.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Study Materials</CardTitle>
              <CardDescription>
                Download lecture notes and other resources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <Download className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Materials Available</h3>
                <p className="mt-1 text-sm text-muted-foreground">This section is under construction.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}