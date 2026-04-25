'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { Calendar, Clock, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

const TODAY_DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
  new Date().getDay()
];

interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  sport: { name: string };
  _count: { enrollments: number };
}

export default function AttendanceIndexPage() {
  const { venueId } = useVenue();

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then(r => r.data),
    enabled: !!venueId,
  });

  const todayBatches = batches.filter(b => b.days?.includes(TODAY_DOW));
  const otherBatches = batches.filter(b => !b.days?.includes(TODAY_DOW));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        <p className="text-gray-500 text-sm">
          {dayjs().format('dddd, DD MMM YYYY')} · Select a batch to mark attendance
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
          No batches found. Add batches first.
        </div>
      ) : (
        <>
          {todayBatches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Today&apos;s Batches
              </h3>
              <div className="space-y-2">
                {todayBatches.map((batch) => (
                  <BatchRow key={batch.id} batch={batch} highlight />
                ))}
              </div>
            </div>
          )}

          {otherBatches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Other Batches
              </h3>
              <div className="space-y-2">
                {otherBatches.map((batch) => (
                  <BatchRow key={batch.id} batch={batch} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BatchRow({ batch, highlight }: { batch: Batch; highlight?: boolean }) {
  return (
    <Link
      href={`/attendance/${batch.id}`}
      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
        highlight
          ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
          : 'bg-white border-gray-100 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Calendar size={18} className={highlight ? 'text-blue-600' : 'text-gray-500'} />
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{batch.name}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {batch.startTime} – {batch.endTime}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {batch._count?.enrollments || 0} students
            </span>
            <span>{batch.sport?.name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex gap-1">
          {batch.days?.map(d => (
            <span
              key={d}
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                d === TODAY_DOW
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {DAY_SHORT[d] || d}
            </span>
          ))}
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    </Link>
  );
}
