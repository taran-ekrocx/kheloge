'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Pencil, X, Check } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { STATE_NAMES, getDistricts } from '@/lib/india-locations';

// ── Constants (mirror coaches list page) ────────────────────────────────────

const PLAYING_LEVELS = ['District', 'State', 'National', 'International'];
const KEY_SKILLS = [
  'Training Kids', 'Training Adults', 'Fitness Conditioning',
  'Discipline & Team Management', 'Event Management', 'Communication Skills',
];
const PAYMENT_TYPES = [
  { value: 'FIXED_PAYMENT', label: 'Fixed Payment' },
  { value: 'REVENUE_PERCENTAGE', label: 'Revenue Percentage' },
  { value: 'PER_SESSION_PAYOUT', label: 'Per Session Payout' },
];

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'batches' | 'attendance';

interface EducationDetail {
  qualification: string; institute: string; year: string;
  remarks: string; sportsCertifications: string;
}
interface CoachingExp {
  organization: string; role: string; duration: string; responsibilities: string;
}
interface CoachProfile {
  educationDetails?: EducationDetail[];
  sportSpecialization?: string;
  playingLevels?: string[];
  achievements?: string;
  coachingExperience?: CoachingExp[];
  keySkills?: string[];
  responsibilities?: string[];
  expectedSalary?: string;
  joiningAvailability?: string;
  paymentType?: string;
  paymentValue?: number | string;
}
interface Coach {
  id: string; userId: string; name: string; phone: string; email?: string;
  status: string; state?: string; district?: string; city?: string; region?: string;
  createdAt: string;
  venue?: { id: string; name: string };
  sports?: { id: string; name: string; icon?: string }[];
  batches?: { batchId: string; isPrimary: boolean; id: string; name: string; sport: { name: string }; venue?: { id: string; name: string } }[];
  profile?: CoachProfile | null;
}
interface Sport { id: string; name: string; icon?: string; }
interface CoachAttendance {
  id: string; date: string; status: 'PRESENT' | 'ABSENT'; batchId: string;
  batch?: { id: string; name: string; sport?: { name: string }; venue?: { id: string; name: string } };
  session?: { id: string; startedAt: string; endedAt?: string };
}

const EMPTY_EDU: EducationDetail = { qualification: '', institute: '', year: '', remarks: '', sportsCertifications: '' };
const EMPTY_EXP: CoachingExp = { organization: '', role: '', duration: '', responsibilities: '' };

function buildForm(coach: Coach) {
  return {
    name: coach.name,
    phone: coach.phone,
    email: coach.email ?? '',
    status: coach.status,
    state: coach.state ?? '',
    district: coach.district ?? '',
    city: coach.city ?? '',
    region: coach.region ?? '',
    sportIds: (coach.sports ?? []).map((s) => s.id),
    profile: {
      educationDetails: (coach.profile?.educationDetails?.length ? coach.profile.educationDetails : [{ ...EMPTY_EDU }]) as EducationDetail[],
      sportSpecialization: coach.profile?.sportSpecialization ?? '',
      playingLevels: coach.profile?.playingLevels ?? [],
      achievements: coach.profile?.achievements ?? '',
      coachingExperience: (coach.profile?.coachingExperience?.length ? coach.profile.coachingExperience : [{ ...EMPTY_EXP }]) as CoachingExp[],
      keySkills: coach.profile?.keySkills ?? [],
      responsibilities: coach.profile?.responsibilities ?? [],
      expectedSalary: coach.profile?.expectedSalary ?? '',
      joiningAvailability: coach.profile?.joiningAvailability ?? '',
      paymentType: (coach.profile as any)?.paymentType ?? '',
      paymentValue: (coach.profile as any)?.paymentValue != null ? String((coach.profile as any).paymentValue) : '',
    },
  };
}

// ── Small helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'PRESENT' | 'ABSENT' }) {
  if (status === 'PRESENT') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
      <CheckCircle className="w-3 h-3" /> Present
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
      <XCircle className="w-3 h-3" /> Absent
    </span>
  );
}


function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
      <h3 className="font-semibold text-gray-800 text-base">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="text-sm text-gray-500 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

function Chips({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-sm text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{i}</span>)}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CoachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const initialTab = searchParams.get('tab') === 'attendance' ? 'attendance' : 'overview';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof buildForm> | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [attVenueId, setAttVenueId] = useState('');
  const [attSportName, setAttSportName] = useState('');
  const [attBatchId, setAttBatchId] = useState('');
  const [attDateFrom, setAttDateFrom] = useState('');
  const [attDateTo, setAttDateTo] = useState('');

  // role starts null on first render (useAuth reads localStorage in useEffect)
  const authLoading = role === null;

  const { data: coach, isLoading } = useQuery<Coach>({
    queryKey: ['coach', id],
    queryFn: () => api.get(`/coaches/${id}`).then((r) => r.data),
    enabled: isSuperAdmin && !!id,
  });

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
    enabled: editing,
  });

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery<CoachAttendance[]>({
    queryKey: ['coach-attendance', id],
    // use userId (User primary key) — the attendance table records by user id, not org-user id
    queryFn: () => api.get(`/attendance/coach-attendance?coachId=${coach!.userId}&months=3`).then((r) => r.data),
    enabled: tab === 'attendance' && isSuperAdmin && !!coach?.userId,
  });

  const filteredAttendance = useMemo(() => {
    return attendance.filter(r => {
      if (attVenueId && r.batch?.venue?.id !== attVenueId) return false;
      if (attSportName && r.batch?.sport?.name !== attSportName) return false;
      if (attBatchId && r.batchId !== attBatchId) return false;
      if (attDateFrom && r.date < attDateFrom) return false;
      if (attDateTo && r.date > attDateTo) return false;
      return true;
    });
  }, [attendance, attVenueId, attSportName, attBatchId, attDateFrom, attDateTo]);

  const saveMutation = useMutation({
    mutationFn: (currentForm: NonNullable<typeof form>) => {
      const payload = {
        name: currentForm.name,
        phone: currentForm.phone,
        email: currentForm.email || undefined,
        status: currentForm.status,
        state: currentForm.state || undefined,
        district: currentForm.district || undefined,
        city: currentForm.city || undefined,
        region: currentForm.region || undefined,
        sportIds: currentForm.sportIds,
        profile: {
          ...currentForm.profile,
          // strip entries where every field is blank
          educationDetails: currentForm.profile.educationDetails.filter(
            (e) => e.qualification || e.institute || e.year || e.sportsCertifications || e.remarks,
          ),
          coachingExperience: currentForm.profile.coachingExperience.filter(
            (e) => e.organization || e.role || e.duration || e.responsibilities,
          ),
          paymentType: currentForm.profile.paymentType || undefined,
          paymentValue: currentForm.profile.paymentValue ? Number(currentForm.profile.paymentValue) : undefined,
        },
      };
      return api.patch(`/coaches/${id}`, payload);
    },
    onSuccess: (response) => {
      // use the updated coach returned by the PATCH — no extra GET needed
      queryClient.setQueryData(['coach', id], response.data);
      queryClient.invalidateQueries({ queryKey: ['coaches-global'] });
      setEditing(false);
      setForm(null);
    },
  });

  const startEdit = () => {
    if (coach) setForm(buildForm(coach));
    setEditing(true);
    setFormErrors({});
  };
  const cancelEdit = () => { setEditing(false); setForm(null); setFormErrors({}); };

  const validateForm = (f: NonNullable<typeof form>): boolean => {
    const next: Record<string, string> = {};
    if (!f.name.trim()) next.name = 'Full name is required';
    if (!f.phone.trim()) next.phone = 'Mobile number is required';
    if (!f.email.trim()) next.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) next.email = 'Enter a valid email address';
    if (!f.state) next.state = 'State is required';
    if (!f.district) next.district = 'District is required';
    if (!f.region.trim()) next.region = 'Region is required';
    if (f.sportIds.length === 0) next.sportIds = 'Please assign at least one sport';
    if (!f.profile.sportSpecialization.trim()) next.sportSpecialization = 'Sport specialization is required';
    const hasAnyExp = f.profile.coachingExperience.some(
      (exp) => exp.organization.trim() || exp.role || exp.duration || exp.responsibilities
    );
    if (!hasAnyExp) next.coachingExperience = 'Please add at least one coaching experience entry';
    f.profile.coachingExperience.forEach((exp, i) => {
      const hasData = exp.role || exp.duration || exp.responsibilities;
      if ((hasData || hasAnyExp) && !exp.organization.trim()) next[`exp_${i}_organization`] = 'Organization is required';
    });
    if (!f.profile.paymentType) next.paymentType = 'Payment type is required';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  // form helpers
  const districts = useMemo(() => (form?.state ? getDistricts(form.state) : []), [form?.state]);

  const setField = (key: string, value: unknown) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const setProfileField = (key: string, value: unknown) =>
    setForm((f) => f ? { ...f, profile: { ...f.profile, [key]: value } } : f);

  const toggleArr = (field: 'playingLevels' | 'keySkills' | 'responsibilities', val: string) =>
    setProfileField(field, (form?.profile[field] as string[] ?? []).includes(val)
      ? (form?.profile[field] as string[]).filter((v) => v !== val)
      : [...(form?.profile[field] as string[] ?? []), val]);

  const toggleSport = (sportId: string) =>
    setField('sportIds', (form?.sportIds ?? []).includes(sportId)
      ? (form?.sportIds ?? []).filter((s) => s !== sportId)
      : [...(form?.sportIds ?? []), sportId]);

  const updateEdu = (i: number, k: keyof EducationDetail, v: string) =>
    setProfileField('educationDetails', form?.profile.educationDetails.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const addEdu = () => setProfileField('educationDetails', [...(form?.profile.educationDetails ?? []), { ...EMPTY_EDU }]);
  const removeEdu = (i: number) => setProfileField('educationDetails', form?.profile.educationDetails.filter((_, idx) => idx !== i));

  const updateExp = (i: number, k: keyof CoachingExp, v: string) =>
    setProfileField('coachingExperience', form?.profile.coachingExperience.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const addExp = () => setProfileField('coachingExperience', [...(form?.profile.coachingExperience ?? []), { ...EMPTY_EXP }]);
  const removeExp = (i: number) => setProfileField('coachingExperience', form?.profile.coachingExperience.filter((_, idx) => idx !== i));

  if (authLoading) {
    return <div className="text-center py-10 text-sm text-gray-400">Loading...</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        This page is only accessible to Super Admins.
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'batches', label: 'Batches' },
    { key: 'attendance', label: 'Attendance' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/coaches" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isLoading ? 'Loading...' : (coach?.name ?? 'Coach Details')}
            </h2>
            {coach && (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                {coach.venue?.name}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${coach.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {coach.status}
                </span>
              </p>
            )}
          </div>
        </div>
        {tab === 'overview' && coach && !editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            <Pencil className="w-4 h-4" /> Edit
          </button>
        )}
        {tab === 'overview' && editing && (
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={() => form && validateForm(form) && saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key !== 'overview') cancelEdit(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
      ) : !coach ? (
        <div className="text-center py-10 text-sm text-gray-400">Coach not found.</div>
      ) : (
        <>
          {/* ── Overview Tab ─────────────────────────────────────────────── */}
          {tab === 'overview' && !editing && (
            <div className="space-y-5">
              <SectionCard title="Basic Details">
                <InfoRow label="Full Name" value={coach.name} />
                <InfoRow label="Mobile Number" value={coach.phone} />
                <InfoRow label="Email" value={coach.email} />
                <InfoRow label="State" value={coach.state} />
                <InfoRow label="District" value={coach.district} />
                <InfoRow label="City" value={coach.city} />
                <InfoRow label="Region" value={coach.region} />
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-sm text-gray-500 sm:w-44 shrink-0">Sports</span>
                  {coach.sports?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {coach.sports.map((s) => (
                        <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {s.icon ? `${s.icon} ` : ''}{s.name}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-sm text-gray-300">—</span>}
                </div>
              </SectionCard>

              <SectionCard title="Education & Certifications">
                {(() => {
                  const entries = (coach.profile?.educationDetails as any[] | undefined)?.filter(
                    (e) => e.qualification || e.institute || e.year || e.sportsCertifications || e.remarks,
                  ) ?? [];
                  return entries.length ? entries.map((edu, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <InfoRow label="Qualification" value={edu.qualification} />
                      <InfoRow label="Institute" value={edu.institute} />
                      <InfoRow label="Year" value={edu.year} />
                      <InfoRow label="Sports Certifications" value={edu.sportsCertifications} />
                      <InfoRow label="Remarks" value={edu.remarks} />
                    </div>
                  )) : <span className="text-sm text-gray-300">—</span>;
                })()}
              </SectionCard>

              <SectionCard title="Sports Background">
                <InfoRow label="Specialization" value={coach.profile?.sportSpecialization} />
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-sm text-gray-500 sm:w-44 shrink-0">Playing Levels</span>
                  <Chips items={coach.profile?.playingLevels} />
                </div>
                <InfoRow label="Achievements" value={coach.profile?.achievements} />
              </SectionCard>

              <SectionCard title="Experience & Skills">
                {(() => {
                  const entries = (coach.profile?.coachingExperience as any[] | undefined)?.filter(
                    (e) => e.organization || e.role || e.duration || e.responsibilities,
                  ) ?? [];
                  return entries.length ? (
                    <div className="space-y-3">
                      {entries.map((exp, i) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <InfoRow label="Organization" value={exp.organization} />
                          <InfoRow label="Role" value={exp.role} />
                          <InfoRow label="Duration" value={exp.duration} />
                          <InfoRow label="Responsibilities" value={exp.responsibilities} />
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-sm text-gray-300">—</span>;
                })()}
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-sm text-gray-500 sm:w-44 shrink-0">Key Skills</span>
                  <Chips items={coach.profile?.keySkills} />
                </div>
              </SectionCard>

              <SectionCard title="Payment Details">
                <InfoRow label="Payment Type" value={PAYMENT_TYPES.find((p) => p.value === (coach.profile as any)?.paymentType)?.label ?? (coach.profile as any)?.paymentType} />
                <InfoRow label="Payment Value" value={(coach.profile as any)?.paymentValue != null ? `₹${Number((coach.profile as any).paymentValue).toLocaleString()}` : undefined} />
              </SectionCard>

            </div>
          )}

          {/* ── Edit Mode ────────────────────────────────────────────────── */}
          {tab === 'overview' && editing && form && (
            <div className="space-y-5">
              {/* Basic Details */}
              <SectionCard title="Basic Details">
                <div className="space-y-3">
                  <div>
                    <input placeholder="Full Name *" value={form.name} onChange={(e) => setField('name', e.target.value)} className={`${inputCls}${formErrors.name ? ' border-red-400' : ''}`} />
                    {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <input placeholder="Mobile Number *" value={form.phone} onChange={(e) => setField('phone', e.target.value)} maxLength={10} className={`${inputCls}${formErrors.phone ? ' border-red-400' : ''}`} />
                    {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                  </div>
                  <div>
                    <input type="email" placeholder="Email *" value={form.email} onChange={(e) => setField('email', e.target.value)} className={`${inputCls}${formErrors.email ? ' border-red-400' : ''}`} />
                    {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Location *</p>
                  <div>
                    <select value={form.state} onChange={(e) => { setField('state', e.target.value); setField('district', ''); setField('city', ''); }} className={`${inputCls}${formErrors.state ? ' border-red-400' : ''}`}>
                      <option value="">Select State *</option>
                      {STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {formErrors.state && <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>}
                  </div>
                  <div>
                    <select value={form.district} onChange={(e) => { setField('district', e.target.value); setField('city', ''); }} disabled={!form.state} className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400${formErrors.district ? ' border-red-400' : ''}`}>
                      <option value="">Select District *</option>
                      {districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                    {formErrors.district && <p className="text-red-500 text-xs mt-1">{formErrors.district}</p>}
                  </div>
                  <div>
                    <input placeholder="Region *" value={form.region} onChange={(e) => setField('region', e.target.value)} className={`${inputCls}${formErrors.region ? ' border-red-400' : ''}`} />
                    {formErrors.region && <p className="text-red-500 text-xs mt-1">{formErrors.region}</p>}
                  </div>
                </div>
              </SectionCard>

              {/* Sports */}
              <SectionCard title="Assign Sports *">
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {sports.map((sport) => (
                    <label key={sport.id} className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox" checked={form.sportIds.includes(sport.id)} onChange={() => toggleSport(sport.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      <span className="text-sm text-gray-700">{sport.icon && <span className="mr-1">{sport.icon}</span>}{sport.name}</span>
                    </label>
                  ))}
                </div>
                {formErrors.sportIds && <p className="text-red-500 text-xs mt-2">{formErrors.sportIds}</p>}
              </SectionCard>

              {/* Education */}
              <SectionCard title="Education & Certifications">
                <div className="space-y-4">
                  {form.profile.educationDetails.map((edu, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">Entry {i + 1}</span>
                        {form.profile.educationDetails.length > 1 && (
                          <button onClick={() => removeEdu(i)} className="text-gray-300 hover:text-red-400"><X size={14} /></button>
                        )}
                      </div>
                      <input placeholder="Qualification" value={edu.qualification} onChange={(e) => updateEdu(i, 'qualification', e.target.value)} className={inputCls} />
                      <input placeholder="Institute" value={edu.institute} onChange={(e) => updateEdu(i, 'institute', e.target.value)} className={inputCls} />
                      <input placeholder="Year" value={edu.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} className={inputCls} />
                      <input placeholder="Sports Certifications" value={edu.sportsCertifications} onChange={(e) => updateEdu(i, 'sportsCertifications', e.target.value)} className={inputCls} />
                      <input placeholder="Remarks" value={edu.remarks} onChange={(e) => updateEdu(i, 'remarks', e.target.value)} className={inputCls} />
                    </div>
                  ))}
                  <button onClick={addEdu} className="text-sm text-blue-600 hover:text-blue-800">+ Add Education</button>
                </div>
              </SectionCard>

              {/* Sports Background */}
              <SectionCard title="Sports Background">
                <div>
                  <input placeholder="Sport Specialization *" value={form.profile.sportSpecialization} onChange={(e) => setProfileField('sportSpecialization', e.target.value)} className={`${inputCls}${formErrors.sportSpecialization ? ' border-red-400' : ''}`} />
                  {formErrors.sportSpecialization && <p className="text-red-500 text-xs mt-1">{formErrors.sportSpecialization}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Playing Levels</p>
                  <div className="flex flex-wrap gap-2">
                    {PLAYING_LEVELS.map((l) => (
                      <label key={l} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={form.profile.playingLevels.includes(l)} onChange={() => toggleArr('playingLevels', l)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <textarea placeholder="Achievements" value={form.profile.achievements} onChange={(e) => setProfileField('achievements', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </SectionCard>

              {/* Experience & Skills */}
              <SectionCard title="Experience & Skills *">
                <div className="space-y-4">
                  {formErrors.coachingExperience && <p className="text-red-500 text-xs">{formErrors.coachingExperience}</p>}
                  {form.profile.coachingExperience.map((exp, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">Entry {i + 1}</span>
                        {form.profile.coachingExperience.length > 1 && (
                          <button onClick={() => removeExp(i)} className="text-gray-300 hover:text-red-400"><X size={14} /></button>
                        )}
                      </div>
                      <div>
                        <input placeholder="Organization *" value={exp.organization} onChange={(e) => updateExp(i, 'organization', e.target.value)} className={`${inputCls}${formErrors[`exp_${i}_organization`] ? ' border-red-400' : ''}`} />
                        {formErrors[`exp_${i}_organization`] && <p className="text-red-500 text-xs mt-1">{formErrors[`exp_${i}_organization`]}</p>}
                      </div>
                      <input placeholder="Role" value={exp.role} onChange={(e) => updateExp(i, 'role', e.target.value)} className={inputCls} />
                      <input placeholder="Duration" value={exp.duration} onChange={(e) => updateExp(i, 'duration', e.target.value)} className={inputCls} />
                      <input placeholder="Responsibilities" value={exp.responsibilities} onChange={(e) => updateExp(i, 'responsibilities', e.target.value)} className={inputCls} />
                    </div>
                  ))}
                  <button onClick={addExp} className="text-sm text-blue-600 hover:text-blue-800">+ Add Experience</button>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Skills</p>
                  <div className="space-y-1">
                    {KEY_SKILLS.map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.profile.keySkills.includes(s)} onChange={() => toggleArr('keySkills', s)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </SectionCard>

              {/* Payment Details */}
              <SectionCard title="Payment Details *">
                <div>
                  <select value={form.profile.paymentType} onChange={(e) => setProfileField('paymentType', e.target.value)} className={`${inputCls}${formErrors.paymentType ? ' border-red-400' : ''}`}>
                    <option value="">Select Payment Type *</option>
                    {PAYMENT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  {formErrors.paymentType && <p className="text-red-500 text-xs mt-1">{formErrors.paymentType}</p>}
                </div>
                {form.profile.paymentType && (
                  <input
                    type="number"
                    placeholder={form.profile.paymentType === 'REVENUE_PERCENTAGE' ? 'Percentage (%)' : 'Amount (₹)'}
                    value={form.profile.paymentValue}
                    onChange={(e) => setProfileField('paymentValue', e.target.value)}
                    className={inputCls}
                  />
                )}
              </SectionCard>
            </div>
          )}

          {/* ── Batches Tab ──────────────────────────────────────────────── */}
          {tab === 'batches' && (
            <SectionCard title="Assigned Batches">
              {coach.batches && coach.batches.length > 0 ? (
                <div className="space-y-2">
                  {coach.batches.map((b) => (
                    <div key={b.batchId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{b.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{b.sport.name}</span>
                        {b.venue && <span className="text-xs text-gray-400 ml-2">· {b.venue.name}</span>}
                      </div>
                      {b.isPrimary && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Primary</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-400">No batches assigned.</span>
              )}
            </SectionCard>
          )}

          {/* ── Attendance Tab ───────────────────────────────────────────── */}
          {tab === 'attendance' && (
            <div>
              {attendanceLoading ? (
                <div className="text-center py-10 text-sm text-gray-400">Loading attendance...</div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No attendance records in the last 3 months.</div>
              ) : (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                      <select
                        value={attVenueId}
                        onChange={e => setAttVenueId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Venues</option>
                        {Array.from(new Map(attendance.filter(r => r.batch?.venue).map(r => [r.batch!.venue!.id, r.batch!.venue!])).values()).map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sport</label>
                      <select
                        value={attSportName}
                        onChange={e => setAttSportName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Sports</option>
                        {Array.from(new Set(attendance.map(r => r.batch?.sport?.name).filter(Boolean))).sort().map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                      <select
                        value={attBatchId}
                        onChange={e => setAttBatchId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Batches</option>
                        {Array.from(new Map(attendance.filter(r => r.batch).map(r => [r.batchId, r.batch!])).values()).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date From</label>
                      <input
                        type="date"
                        value={attDateFrom}
                        onChange={e => setAttDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date To</label>
                      <input
                        type="date"
                        value={attDateTo}
                        onChange={e => setAttDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <h3 className="font-semibold text-gray-800">Session Attendance — Last 3 Months</h3>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-600 font-medium">{filteredAttendance.filter((a) => a.status === 'PRESENT').length} Present</span>
                        <span className="text-red-600 font-medium">{filteredAttendance.filter((a) => a.status === 'ABSENT').length} Absent</span>
                      </div>
                    </div>
                    {filteredAttendance.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-400">No records match the selected filters.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Sport</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Venue</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Batch</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Start Time</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">End Time</th>
                            <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredAttendance.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 text-gray-600">{record.batch?.sport?.name ?? '—'}</td>
                              <td className="px-5 py-3 text-gray-600">{record.batch?.venue?.name ?? '—'}</td>
                              <td className="px-5 py-3 text-gray-600">{record.batch?.name ?? '—'}</td>
                              <td className="px-5 py-3 text-gray-900">{dayjs(record.date).format('DD MMM YYYY')}</td>
                              <td className="px-5 py-3 text-gray-500">
                                {record.session ? dayjs(record.session.startedAt).format('h:mm A') : '—'}
                              </td>
                              <td className="px-5 py-3 text-gray-500">
                                {record.session?.endedAt ? dayjs(record.session.endedAt).format('h:mm A') : '—'}
                              </td>
                              <td className="px-5 py-3"><StatusBadge status={record.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}
