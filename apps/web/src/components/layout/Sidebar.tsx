'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthService } from '@/lib/auth';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Users, Calendar, CheckSquare,
  CreditCard, MessageSquare, LogOut, Building2,
  Trophy, MapPin, UsersRound, UserCheck, BarChart2, Receipt, ChevronDown,
} from 'lucide-react';

const NAV_OPERATIONS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/batches', label: 'Batches', icon: Calendar },
  { href: '/coaches', label: 'Coaches', icon: UserCheck, hideForCoach: true },
  { href: '/attendance', label: 'Attendance', icon: CheckSquare },
  { href: '/fees', label: 'Fees', icon: Receipt, hideForCoach: true },
  { href: '/payments', label: 'Payments', icon: CreditCard, hideForCoach: true },
  { href: '/enquiries', label: 'Enquiries', icon: MessageSquare, hideForCoach: true },
  { href: '/reports', label: 'Reports', icon: BarChart2, hideForCoach: true },
];

const NAV_ADMIN = [
  { href: '/venues', label: 'Venues', icon: Building2 },
  { href: '/sports', label: 'Sports', icon: Trophy },
  { href: '/cities', label: 'Cities', icon: MapPin },
  { href: '/users', label: 'Team', icon: UsersRound },
];

function VenueSelector({ role }: { role: string | null }) {
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isCityManager = role === 'CITY_MANAGER';
  const { venueId, selectVenue } = useVenue();

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !isCoach,
  });

  // Auto-select first venue for venue-scoped roles (not coaches — they scope via batches).
  useEffect(() => {
    if (role === null || isSuperAdmin || isCityManager || isCoach || venueId) return;
    if (venues.length > 0) selectVenue(venues[0].id);
  }, [role, isSuperAdmin, isCityManager, isCoach, venueId, venues, selectVenue]);

  if (role === null || isCoach || isSuperAdmin || isCityManager || venues.length <= 1) return null;

  return (
    <div className="px-3 pb-3">
      <p className="px-1 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Venue</p>
      <div className="relative">
        <select
          value={venueId}
          onChange={(e) => selectVenue(e.target.value)}
          className="w-full appearance-none bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
      </div>
    </div>
  );
}

function NavGroup({ label, items, isCoach }: { label: string; items: typeof NAV_OPERATIONS; isCoach?: boolean }) {
  const pathname = usePathname();
  const visibleItems = isCoach ? items.filter((item) => !(item as any).hideForCoach) : items;
  return (
    <div>
      <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {visibleItems.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon size={18} />
            {itemLabel}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-blue-700">Kheloge</h1>
        <p className="text-xs text-gray-400 mt-0.5">Sports Management</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <VenueSelector role={role} />
        <NavGroup label="Operations" items={NAV_OPERATIONS} isCoach={isCoach} />
        {!isCoach && <NavGroup label="Administration" items={NAV_ADMIN} />}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={() => AuthService.logout()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
