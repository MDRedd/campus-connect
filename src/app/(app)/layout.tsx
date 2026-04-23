'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/app-header';
import AppSidebar from '@/components/layout/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Sparkles } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen w-full bg-[#0a0c10] items-center justify-center">
         <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="bg-primary p-6 rounded-[2.5rem] shadow-[0_0_50px_-10px_rgba(79,70,229,0.5)]">
                <GraduationCap className="h-12 w-12 text-white" />
            </div>
            <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Synchronizing Identity Ledger</span>
            </div>
         </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background transition-colors duration-500">
        <AppSidebar />
        <div className="flex flex-col flex-1 sm:pl-14">
            <AppHeader />
            <main className="flex-1 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {children}
            </main>
        </div>
      </div>
    </SidebarProvider>
  );
}