import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';

type QuickStat = {
  title: string;
  value: string;
  icon: LucideIcon;
};

type QuickStatsProps = {
  stats: QuickStat[] | null;
  isLoading: boolean;
};

export default function QuickStats({ stats, isLoading }: QuickStatsProps) {

  if (isLoading) {
    return (
        <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-[2rem] opacity-20" />
            ))}
        </div>
    )
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title} className="glass-card border-none overflow-hidden group shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{stat.title}</CardTitle>
            <div className="p-2.5 bg-primary/5 rounded-xl text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-black tracking-tighter text-slate-800 leading-none">{stat.value}</div>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">System Ledger Synchronized</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
