'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type AttendanceChartProps = {
  data: {
    name: string;
    attended: number;
    total: number;
    percentage: number;
  }[];
};

export default function AttendanceChart({ data }: AttendanceChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartConfig = {
    percentage: {
      label: 'Attendance %',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Overview</CardTitle>
        <CardDescription>Your attendance percentage across courses.</CardDescription>
      </CardHeader>
      <CardContent>
        {isClient ? (
            <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 10,
                            left: -10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        />
                        <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent
                            formatter={(value, name, props) => (
                                <div className="flex flex-col">
                                    <span>{props.payload.name}: {value}%</span>
                                    <span className="text-xs text-muted-foreground">{props.payload.attended} / {props.payload.total} classes</span>
                                </div>
                            )}
                        />}
                        />
                        <Bar dataKey="percentage" fill="var(--color-percentage)" radius={4} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
        ) : (
            <Skeleton className="h-64 w-full" />
        )}
      </CardContent>
    </Card>
  );
}
