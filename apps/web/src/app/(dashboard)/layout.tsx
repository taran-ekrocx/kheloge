import { Sidebar } from '@/components/layout/Sidebar';
import { ActiveSessionBanner } from '@/components/layout/ActiveSessionBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <ActiveSessionBanner />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
