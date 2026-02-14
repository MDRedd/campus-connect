'use client';

import { Pie, PieChart, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export type RoleData = {
  name: string;
  value: number;
  fill: string;
};

type RoleDistributionChartProps = {
  data: RoleData[];
};

export default function RoleDistributionChart({ data }: RoleDistributionChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = { label: item.name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()), color: item.fill };
    return acc;
  }, {} as any);

  if (!isClient) {
    return <Skeleton className="h-80 w-full" />;
  }

  if (data.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Role Distribution</CardTitle>
                <CardDescription>No user data available to display.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">User roles will be shown here.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Distribution</CardTitle>
        <CardDescription>A breakdown of user roles across the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${chartConfig[name].label}: ${value}`}
                    >
                         {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
