'use client';

import { Sparkles, Calendar } from 'lucide-react';
import { format } from 'date-fns';

type WelcomeBannerProps = {
    user: { name: string; role: string };
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const today = format(new Date(), 'EEEE, MMMM do');

    return (
        <div className="academic-hero animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                        <Sparkles className="h-3 w-3" /> System Verified {user.role.replace('-', ' ')}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">
                        {getGreeting()}, <br />
                        <span className="text-white/80">{user.name.split(' ')[0]}</span>
                    </h1>
                    <p className="text-lg text-indigo-100/70 font-medium max-w-md">
                        Ready for another productive day at Campus Connect? Here is your personalized overview.
                    </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2 text-indigo-50/80">
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-bold tracking-tight">{today}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}