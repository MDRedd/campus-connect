'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export type DepartmentChartData = {
  name: string;
  count: number;
};

type CourseDepartmentChartProps = {
  data: DepartmentChartData[];
};

export default function CourseDepartmentChart({ data }: CourseDepartmentChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartConfig = {
    count: {
      label: 'Courses',
      color: 'hsl(var(--primary))',
    },
  };

  if (!isClient) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (data.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Courses by Department</CardTitle>
                <CardDescription>No course data available yet.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">Course counts will appear here.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courses by Department</CardTitle>
        <CardDescription>Number of courses offered by each department.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
