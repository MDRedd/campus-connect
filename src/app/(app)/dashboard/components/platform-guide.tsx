'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Compass, ShieldCheck, Zap, Laptop, Tablet, Smartphone, GraduationCap, Users, Database, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type GuideStep = {
  title: string;
  description: string;
  icon: React.ElementType;
  instruction: string;
};

type PlatformGuideProps = {
  role: 'student' | 'faculty' | 'admin' | 'super-admin' | 'user-admin' | 'course-admin' | 'attendance-admin';
};

export default function PlatformGuide({ role }: PlatformGuideProps) {
  const isStudent = role === 'student';
  const isFaculty = role === 'faculty';
  const isAdmin = role.includes('admin');

  const steps: GuideStep[] = [];

  if (isStudent) {
    steps.push(
      { 
        title: 'IDENTITY SYNC', 
        description: 'Set up your digital persona.', 
        instruction: 'Go to "Profile" to verify your details and department.',
        icon: Users 
      },
      { 
        title: 'SECURE CHECK-IN', 
        description: 'Authorize your presence.', 
        instruction: 'Use the "Scan Terminal" to scan faculty QR codes during class.',
        icon: Smartphone 
      },
      { 
        title: 'ACADEMIC GROWTH', 
        description: 'Engage with AI-enhanced tools.', 
        instruction: 'Access "Academics" for AI material summaries and practice quizzes.',
        icon: Zap 
      }
    );
  } else if (isFaculty) {
    steps.push(
      { 
        title: 'TEMPORAL ALLOCATION', 
        description: 'Set your teaching schedule.', 
        instruction: 'Assign your sessions in the "Timetable" to populate your dashboard.',
        icon: Laptop 
      },
      { 
        title: 'PRESENCE MASTER', 
        description: 'Generate dynamic QR tokens.', 
        instruction: 'Open "Mark Attendance" to start a live session for your students.',
        icon: Sparkles 
      },
      { 
        title: 'AI AUDIT LOOP', 
        description: 'Automate feedback delivery.', 
        instruction: 'Review assignments and use the AI layer to synthesize grading feedback.',
        icon: Compass 
      }
    );
  } else {
    steps.push(
      { 
        title: 'IDENTITY PROVISION', 
        description: 'Manage institutional personas.', 
        instruction: 'Use the "Users" directory to onboard new students and faculty.',
        icon: Users 
      },
      { 
        title: 'CATALOG GOVERNANCE', 
        description: 'Configure academic nodes.', 
        instruction: 'Update the "Course Management" ledger to reflect the current term.',
        icon: Database 
      },
      { 
        title: 'SYSTEM BROADCAST', 
        description: 'Disseminate critical alerts.', 
        instruction: 'Use "Announcements" to reach specific roles via the AI-drafting engine.',
        icon: ShieldCheck 
      }
    );
  }

  return (
    <Card className="glass-card border-neon border-none overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CardHeader className="bg-primary/5 p-8 md:p-10 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                <GraduationCap className="h-3 w-3" /> Mission Protocol
             </div>
             <CardTitle className="text-3xl md:text-4xl font-black uppercase tracking-tight">PLATFORM ORIENTATION</CardTitle>
             <CardDescription className="text-base md:text-lg font-medium max-w-2xl leading-relaxed text-slate-500">
                Campus Connect is a unified digital ecosystem designed to bridge the gap between academic and administrative layers. We prioritize transparency, AI-driven efficiency, and secure data distribution across the student body.
             </CardDescription>
          </div>
          <div className="hidden sm:flex gap-3 opacity-20">
            <Smartphone className="h-8 w-8" />
            <Tablet className="h-8 w-8" />
            <Laptop className="h-8 w-8" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 md:p-10 bg-white/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="group p-8 rounded-[2.5rem] bg-white/60 border border-indigo-50/50 hover:bg-white transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
               <div className="flex justify-between items-start mb-6">
                  <div className="bg-primary/10 text-primary p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="text-3xl font-black opacity-5 text-slate-900">0{idx + 1}</span>
               </div>
               <h4 className="font-black text-slate-800 uppercase tracking-tight mb-3 text-lg">{step.title}</h4>
               <p className="text-sm text-slate-600 font-bold mb-4 leading-snug">"{step.description}"</p>
               <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3" /> Instruction
                  </p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed italic">{step.instruction}</p>
               </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
