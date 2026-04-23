'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Compass, ShieldCheck, Zap, Laptop, Tablet, Smartphone, GraduationCap, Users, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

type GuideStep = {
  title: string;
  description: string;
  icon: React.ElementType;
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
      { title: 'Secure Check-in', description: 'Access the "Scan terminal" to synchronize your presence via faculty QR tokens.', icon: Smartphone },
      { title: 'Academic Hub', description: 'Submit digital assets for grading and access AI-synthesized course summaries.', icon: Zap },
      { title: 'Intellectual Ledger', description: 'Track your GPA indices and resolve financial dues in real-time.', icon: ShieldCheck }
    );
  } else if (isFaculty) {
    steps.push(
      { title: 'Presence Mastery', description: 'Generate dynamic QR tokens to authorize real-time student check-ins.', icon: Laptop },
      { title: 'AI Grading Audit', description: 'Review submissions and synthesize personalized feedback using the GenAI layer.', icon: Sparkles },
      { title: 'Risk Intelligence', description: 'Monitor low-attendance indices and nudge at-risk students proactively.', icon: Compass }
    );
  } else {
    steps.push(
      { title: 'Identity Master', description: 'Provision new system identities and synchronize departmental roles.', icon: Users },
      { title: 'Financial Admin', description: 'Execute bulk fee assignments and track system-wide collection indices.', icon: Database },
      { title: 'Catalog Governance', description: 'Configure master course structures and manage institutional metadata.', icon: ShieldCheck }
    );
  }

  return (
    <Card className="glass-card border-neon border-none overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CardHeader className="bg-primary/5 p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                <GraduationCap className="h-3 w-3" /> Mission Protocol
             </div>
             <CardTitle className="text-3xl font-black uppercase tracking-tight">PLATFORM ORIENTATION</CardTitle>
             <CardDescription className="text-base font-medium max-w-2xl leading-relaxed">
                Campus Connect is a unified digital ecosystem designed to bridge the gap between academic and administrative layers. We prioritize transparency, AI-driven efficiency, and secure data distribution.
             </CardDescription>
          </div>
          <div className="flex gap-2 opacity-20">
            <Smartphone className="h-6 w-6" />
            <Tablet className="h-6 w-6" />
            <Laptop className="h-6 w-6" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="group p-6 rounded-[2rem] bg-white/40 border border-indigo-50/50 hover:bg-white transition-all duration-500 shadow-sm hover:shadow-xl">
               <div className="bg-primary/5 text-primary p-4 rounded-2xl w-fit group-hover:scale-110 transition-transform mb-4">
                  <step.icon className="h-6 w-6" />
               </div>
               <h4 className="font-black text-slate-800 uppercase tracking-tight mb-2">{step.title}</h4>
               <p className="text-sm text-slate-500 font-medium leading-relaxed italic">"{step.description}"</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
