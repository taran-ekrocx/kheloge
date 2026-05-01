'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Plus } from 'lucide-react';

const STAGES = [
  { key: 'NEW', label: 'New', color: 'bg-gray-100 text-gray-700' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  { key: 'TRIAL_SCHEDULED', label: 'Trial Scheduled', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'TRIAL_DONE', label: 'Trial Done', color: 'bg-orange-100 text-orange-700' },
  { key: 'CONVERTED', label: 'Converted', color: 'bg-green-100 text-green-700' },
  { key: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-700' },
];

const NEXT_STAGE: Record<string, string> = {
  NEW: 'CONTACTED',
  CONTACTED: 'TRIAL_SCHEDULED',
  TRIAL_SCHEDULED: 'TRIAL_DONE',
  TRIAL_DONE: 'CONVERTED',
};

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  sportInterest?: string;
  stage: string;
  source?: string;
  followUpAt?: string;
}

function EnquiryCard({ enquiry, onAdvance }: { enquiry: Enquiry; onAdvance: () => void }) {
  const next = NEXT_STAGE[enquiry.stage];
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 space-y-2">
      <p className="font-medium text-sm text-gray-900">{enquiry.name}</p>
      <p className="text-xs text-gray-500">{enquiry.phone}</p>
      {enquiry.sportInterest && (
        <span className="inline-block bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">
          {enquiry.sportInterest}
        </span>
      )}
      {next && (
        <button
          onClick={onAdvance}
          className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium text-left mt-1"
        >
          Move to {NEXT_STAGE[enquiry.stage].replace('_', ' ')} →
        </button>
      )}
    </div>
  );
}

export default function EnquiriesPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const { data: enquiries = [], isLoading } = useQuery<Enquiry[]>({
    queryKey: isSuperAdmin ? ['enquiries-global'] : ['enquiries', venueId],
    queryFn: isSuperAdmin
      ? () => api.get('/enquiries').then(r => r.data)
      : () => api.get(`/venues/${venueId}/enquiries`).then(r => r.data),
    enabled: isSuperAdmin ? true : !!venueId,
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.patch(`/venues/${venueId}/enquiries/${id}/stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries', venueId] });
      queryClient.invalidateQueries({ queryKey: ['enquiries-global'] });
    },
  });

  const byStage = STAGES.reduce<Record<string, Enquiry[]>>((acc, { key }) => {
    acc[key] = enquiries.filter(e => e.stage === key);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Enquiries</h2>
          <p className="text-gray-500 text-sm">{enquiries.length} total leads</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading enquiries...</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
          {STAGES.map(({ key, label, color }) => (
            <div key={key} className="min-w-[160px]">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
                <span className="text-xs text-gray-400">{byStage[key]?.length || 0}</span>
              </div>
              <div className="space-y-2">
                {byStage[key]?.map(eq => (
                  <EnquiryCard
                    key={eq.id}
                    enquiry={eq}
                    onAdvance={() => {
                      const next = NEXT_STAGE[eq.stage];
                      if (next) advanceMutation.mutate({ id: eq.id, stage: next });
                    }}
                  />
                ))}
                {byStage[key]?.length === 0 && (
                  <div className="border-2 border-dashed border-gray-100 rounded-lg p-3 text-xs text-gray-300 text-center">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
