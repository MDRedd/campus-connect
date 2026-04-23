'use client';

import { Sparkles, Calendar, Clock, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

type WelcomeBannerProps = {
    user: { name: string; role: string };
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        setCurrentTime(format(new Date(), 'HH:mm'));
        const timer = setInterval(() => setCurrentTime(format(new Date(), 'HH:mm')), 60000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const today = format(new Date(), 'EEEE, MMMM do');

    return (
        <div className="academic-hero animate-in fade-in slide-in-from-top-6 duration-1000">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                <div className="space-y-6">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-inner">
                        <Sparkles className="h-3 w-3 text-amber-300" /> System Authorized {user.role.replace('-', ' ')}
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85] text-glow">
                            {getGreeting()}, <br />
                            <span className="text-white/70 italic font-medium">{user.name.split(' ')[0]}</span>
                        </h1>
                    </div>
                    <div className="flex flex-col gap-2 border-l-2 border-white/20 pl-6">
                        <p className="text-lg text-indigo-100/80 font-medium max-w-md leading-tight">
                            Your personalized institutional workspace is synchronized.
                        </p>
                        <p className="text-xs text-indigo-200/60 font-black uppercase tracking-[0.1em] flex items-center gap-2">
                            <GraduationCap className="h-3 w-3" /> Campus Connect v2.0 Node Active
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
                    <div className="flex items-center gap-4 bg-black/20 px-8 py-5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
                        <div className="p-3 bg-white/10 rounded-2xl">
                            <Clock className="h-7 w-7 text-indigo-200" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300/60">Local Sync</p>
                            <p className="text-3xl font-black tracking-tighter tabular-nums">{currentTime}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-white/10 px-6 py-3 rounded-2xl border border-white/5 backdrop-blur-md">
                        <Calendar className="h-4 w-4 text-white/40" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{today}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-green-300">Cloud Link Established</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
