'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export type GradeChartData = {
  name: string; // Grade (e.g., 'A', 'B+')
  count: number;
};

type GradeDistributionChartProps = {
  data: GradeChartData[];
};

export default function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartConfig = {
    count: {
      label: 'Students',
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
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>No result data available yet for this course.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">Grade distribution will appear here once results are published.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade Distribution</CardTitle>
        <CardDescription>Distribution of grades for this course.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
