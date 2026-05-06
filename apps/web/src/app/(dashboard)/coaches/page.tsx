'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Search, UserPlus, Filter, X, Edit2, Trash2, User, Plus, Eye } from 'lucide-react';
import Link from 'next/link';
import { STATE_NAMES, getDistricts } from '@/lib/india-locations';

const COACH_STEP_LABELS = [
  'Basic Details',
  'Education & Certs',
  'Sports Background',
  'Experience & Skills',
  'Payment Type',
];

const PLAYING_LEVELS = ['District', 'State', 'National', 'International'];
const KEY_SKILLS = [
  'Training Kids',
  'Training Adults',
  'Fitness Conditioning',
  'Discipline & Team Management',
  'Event Management',
  'Communication Skills',
];
const RESPONSIBILITIES = [
  'Conduct structured training sessions',
  'Plan weekly training schedules',
  'Focus on skill development & fitness',
  'Maintain safety during sessions',
  'Track student performance',
  'Assist in events & demo classes',
];

interface EducationDetail {
  qualification: string;
  institute: string;
  year: string;
  remarks: string;
  sportsCertifications: string;
}

interface CoachingExp {
  organization: string;
  role: string;
  duration: string;
  responsibilities: string;
}

const PAYMENT_TYPES = [
  { value: 'FIXED_PAYMENT', label: 'Fixed Payment' },
  { value: 'REVENUE_PERCENTAGE', label: 'Revenue Percentage' },
  { value: 'PER_SESSION_PAYOUT', label: 'Per Session Payout' },
] as const;

interface CoachProfile {
  educationDetails: EducationDetail[];
  sportSpecialization: string;
  playingLevels: string[];
  achievements: string;
  coachingExperience: CoachingExp[];
  keySkills: string[];
  responsibilities: string[];
  expectedSalary: string;
  joiningAvailability: string;
  paymentType: string;
  paymentValue: string;
}

interface CoachBatch { id: string; name: string; sport?: { name: string }; }
interface CoachSportItem { id: string; name: string; icon?: string; }
interface Coach {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  state?: string;
  district?: string;
  city?: string;
  region?: string;
  sports?: CoachSportItem[];
  batches?: CoachBatch[];
  _count?: { batches: number };
  profile?: CoachProfile | null;
}
interface Sport { id: string; name: string; icon?: string; }

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
};

function extractMobileDigits(raw: string): string | null {
  const stripped = raw.replace(/\s/g, '').replace(/^\+/, '');
  if (/^\d{10}$/.test(stripped)) return stripped;
  if (/^91\d{10}$/.test(stripped)) return stripped.slice(2);
  return null;
}

const EMPTY_EDUCATION: EducationDetail = { qualification: '', institute: '', year: '', remarks: '', sportsCertifications: '' };
const EMPTY_EXP: CoachingExp = { organization: '', role: '', duration: '', responsibilities: '' };

const EMPTY_PROFILE: CoachProfile = {
  educationDetails: [{ ...EMPTY_EDUCATION }],
  sportSpecialization: '',
  playingLevels: [],
  achievements: '',
  coachingExperience: [{ ...EMPTY_EXP }],
  keySkills: [],
  responsibilities: [],
  expectedSalary: '',
  joiningAvailability: '',
  paymentType: '',
  paymentValue: '',
};

const DEFAULT_FORM = {
  name: '', phone: '', email: '', status: 'ACTIVE',
  state: '', district: '', city: '', region: '',
  sportIds: [] as string[],
  profile: EMPTY_PROFILE,
};

function buildInitialForm(existing?: Coach) {
  if (!existing) return DEFAULT_FORM;
  return {
    name: existing.name,
    phone: existing.phone,
    email: existing.email || '',
    status: existing.status,
    state: existing.state || '',
    district: existing.district || '',
    city: existing.city || '',
    region: existing.region || '',
    sportIds: (existing.sports ?? []).map((s) => s.id),
    profile: existing.profile ? {
      educationDetails: (existing.profile.educationDetails?.length ? existing.profile.educationDetails : [{ ...EMPTY_EDUCATION }]),
      sportSpecialization: existing.profile.sportSpecialization || '',
      playingLevels: existing.profile.playingLevels || [],
      achievements: existing.profile.achievements || '',
      coachingExperience: (existing.profile.coachingExperience?.length ? existing.profile.coachingExperience : [{ ...EMPTY_EXP }]),
      keySkills: existing.profile.keySkills || [],
      responsibilities: existing.profile.responsibilities || [],
      expectedSalary: existing.profile.expectedSalary || '',
      joiningAvailability: existing.profile.joiningAvailability || '',
      paymentType: (existing.profile as any).paymentType || '',
      paymentValue: (existing.profile as any).paymentValue != null ? String((existing.profile as any).paymentValue) : '',
    } : { ...EMPTY_PROFILE },
  };
}

function CoachModal({
  onClose, venueId, existing, queryKey,
}: {
  onClose: () => void; venueId?: string; existing?: Coach; queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(() => buildInitialForm(existing));

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
  });

  const toggleSport = (sportId: string) => {
    setForm((f) => ({
      ...f,
      sportIds: f.sportIds.includes(sportId)
        ? f.sportIds.filter((id) => id !== sportId)
        : [...f.sportIds, sportId],
    }));
  };

  const toggleCheckbox = (field: 'playingLevels' | 'keySkills' | 'responsibilities', value: string) => {
    setForm((f) => {
      const arr = f.profile[field] as string[];
      return {
        ...f,
        profile: {
          ...f.profile,
          [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
        },
      };
    });
  };

  const updateEdu = (index: number, key: keyof EducationDetail, value: string) => {
    setForm((f) => {
      const items = [...f.profile.educationDetails];
      items[index] = { ...items[index], [key]: value };
      return { ...f, profile: { ...f.profile, educationDetails: items } };
    });
  };

  const addEdu = () => setForm((f) => ({
    ...f,
    profile: { ...f.profile, educationDetails: [...f.profile.educationDetails, { ...EMPTY_EDUCATION }] },
  }));

  const removeEdu = (index: number) => setForm((f) => ({
    ...f,
    profile: { ...f.profile, educationDetails: f.profile.educationDetails.filter((_, i) => i !== index) },
  }));

  const updateExp = (index: number, key: keyof CoachingExp, value: string) => {
    setForm((f) => {
      const items = [...f.profile.coachingExperience];
      items[index] = { ...items[index], [key]: value };
      return { ...f, profile: { ...f.profile, coachingExperience: items } };
    });
  };

  const addExp = () => setForm((f) => ({
    ...f,
    profile: { ...f.profile, coachingExperience: [...f.profile.coachingExperience, { ...EMPTY_EXP }] },
  }));

  const removeExp = (index: number) => setForm((f) => ({
    ...f,
    profile: { ...f.profile, coachingExperience: f.profile.coachingExperience.filter((_, i) => i !== index) },
  }));

  const districts = useMemo(() => form.state ? getDistricts(form.state) : [], [form.state]);

  const handleStateChange = (state: string) => setForm(f => ({ ...f, state, district: '', city: '' }));
  const handleDistrictChange = (district: string) => setForm(f => ({ ...f, district, city: '' }));

  const validateStep = (step: number): boolean => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!form.name.trim()) next.name = 'Full name is required';
      if (!form.phone.trim()) {
        next.phone = 'Mobile number is required';
      } else if (!extractMobileDigits(form.phone)) {
        next.phone = 'Enter a valid 10-digit mobile number (with or without +91)';
      }
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        next.email = 'Enter a valid email address';
      }
    }
    if (step === 2) {
      form.profile.educationDetails.forEach((edu, i) => {
        const hasAnyData = edu.institute || edu.year || edu.sportsCertifications || edu.remarks;
        if (hasAnyData && !edu.qualification.trim()) {
          next[`edu_${i}_qualification`] = 'Qualification is required when other fields are filled';
        }
      });
    }
    if (step === 4) {
      form.profile.coachingExperience.forEach((exp, i) => {
        const hasAnyData = exp.role || exp.duration || exp.responsibilities;
        if (hasAnyData && !exp.organization.trim()) {
          next[`exp_${i}_organization`] = 'Organization is required when other fields are filled';
        }
      });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => { if (validateStep(currentStep)) setCurrentStep((s) => s + 1); };
  const handleBack = () => { setErrors({}); setCurrentStep((s) => s - 1); };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        phone: `+91${extractMobileDigits(form.phone) ?? form.phone}`,
        email: form.email || undefined,
        status: form.status,
        state: form.state || undefined,
        district: form.district || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        sportIds: form.sportIds,
        profile: {
          ...form.profile,
          paymentType: form.profile.paymentType || undefined,
          paymentValue: form.profile.paymentValue ? Number(form.profile.paymentValue) : undefined,
        },
      };
      if (existing) {
        return venueId
          ? api.patch(`/venues/${venueId}/coaches/${existing.id}`, payload)
          : api.patch(`/coaches/${existing.id}`, payload);
      }
      return venueId
        ? api.post(`/venues/${venueId}/coaches`, payload)
        : api.post('/coaches', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onClose();
    },
  });

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{existing ? 'Edit Coach' : 'Add Coach'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Progress indicator */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Step {currentStep} of {COACH_STEP_LABELS.length}</span>
            <span className="text-xs font-medium text-blue-600">{COACH_STEP_LABELS[currentStep - 1]}</span>
          </div>
          <div className="flex gap-1">
            {COACH_STEP_LABELS.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Basic Details */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <input
                placeholder="Full Name *"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className={`${inputCls}${errors.name ? ' border-red-400' : ''}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <input
                placeholder="Mobile Number *"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                className={`${inputCls}${errors.phone ? ' border-red-400' : ''}`}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className={`${inputCls}${errors.email ? ' border-red-400' : ''}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <select
              value={form.status}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
              className={inputCls}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</p>
              <div className="space-y-2">
                <select
                  value={form.state}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select State</option>
                  {STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={form.district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!form.state}
                  className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}
                >
                  <option value="">Select District</option>
                  {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <input
                  placeholder="Region"
                  value={form.region}
                  onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign Sports</p>
              {sports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No sports configured yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {sports.map((sport) => (
                    <label key={sport.id} className="flex items-center gap-2 cursor-pointer group py-1">
                      <input
                        type="checkbox"
                        checked={form.sportIds.includes(sport.id)}
                        onChange={() => toggleSport(sport.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        {sport.icon && <span className="mr-1">{sport.icon}</span>}
                        {sport.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Educational & Certification Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Add educational qualifications and certifications (optional)</p>
            {form.profile.educationDetails.map((edu, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">Entry {i + 1}</p>
                  {form.profile.educationDetails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEdu(i)}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      <Trash2 size={12} /> Remove Entry
                    </button>
                  )}
                </div>
                <div>
                  <input
                    placeholder="Qualification *"
                    value={edu.qualification}
                    onChange={(e) => updateEdu(i, 'qualification', e.target.value)}
                    className={`${inputCls}${errors[`edu_${i}_qualification`] ? ' border-red-400' : ''}`}
                  />
                  {errors[`edu_${i}_qualification`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`edu_${i}_qualification`]}</p>
                  )}
                </div>
                <input placeholder="Institute / Board" value={edu.institute} onChange={(e) => updateEdu(i, 'institute', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Year" value={edu.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} className={inputCls} />
                  <input placeholder="Sports Certifications" value={edu.sportsCertifications} onChange={(e) => updateEdu(i, 'sportsCertifications', e.target.value)} className={inputCls} />
                </div>
                <textarea
                  placeholder="Remarks"
                  value={edu.remarks}
                  onChange={(e) => updateEdu(i, 'remarks', e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addEdu}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus size={14} /> Add Another Entry
            </button>
          </div>
        )}

        {/* Step 3: Sports Background */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <input
              placeholder="Sport Specialization"
              value={form.profile.sportSpecialization}
              onChange={(e) => setForm(f => ({ ...f, profile: { ...f.profile, sportSpecialization: e.target.value } }))}
              className={inputCls}
            />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Playing Level</p>
              <div className="grid grid-cols-2 gap-2">
                {PLAYING_LEVELS.map((level) => (
                  <label key={level} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.profile.playingLevels.includes(level)}
                      onChange={() => toggleCheckbox('playingLevels', level)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{level}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Achievements</p>
              <textarea
                placeholder="List any notable achievements..."
                value={form.profile.achievements}
                onChange={(e) => setForm(f => ({ ...f, profile: { ...f.profile, achievements: e.target.value } }))}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        )}

        {/* Step 4: Coaching Experience & Key Skills */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Coaching Experience</p>
              {form.profile.coachingExperience.map((exp, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">Experience {i + 1}</p>
                    {form.profile.coachingExperience.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExp(i)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        <Trash2 size={12} /> Remove Experience
                      </button>
                    )}
                  </div>
                  <div>
                    <input
                      placeholder="Organization / Academy *"
                      value={exp.organization}
                      onChange={(e) => updateExp(i, 'organization', e.target.value)}
                      className={`${inputCls}${errors[`exp_${i}_organization`] ? ' border-red-400' : ''}`}
                    />
                    {errors[`exp_${i}_organization`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`exp_${i}_organization`]}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Role" value={exp.role} onChange={(e) => updateExp(i, 'role', e.target.value)} className={inputCls} />
                    <input placeholder="Duration" value={exp.duration} onChange={(e) => updateExp(i, 'duration', e.target.value)} className={inputCls} />
                  </div>
                  <textarea
                    placeholder="Responsibilities"
                    value={exp.responsibilities}
                    onChange={(e) => updateExp(i, 'responsibilities', e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addExp}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={14} /> Add Another Experience
              </button>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Skills</p>
              <div className="space-y-1.5">
                {KEY_SKILLS.map((skill) => (
                  <label key={skill} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.profile.keySkills.includes(skill)}
                      onChange={() => toggleCheckbox('keySkills', skill)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{skill}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Payment Type */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Select a payment type and enter the relevant amount (optional)</p>
            <div className="space-y-2">
              {PAYMENT_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer border rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="paymentType"
                    value={value}
                    checked={form.profile.paymentType === value}
                    onChange={() => setForm(f => ({ ...f, profile: { ...f.profile, paymentType: value, paymentValue: '' } }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              {form.profile.paymentType && (
                <label className="flex items-center gap-3 cursor-pointer border rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors text-gray-400">
                  <input
                    type="radio"
                    name="paymentType"
                    value=""
                    checked={false}
                    onChange={() => setForm(f => ({ ...f, profile: { ...f.profile, paymentType: '', paymentValue: '' } }))}
                    className="h-4 w-4 text-gray-400 focus:ring-gray-300"
                  />
                  <span className="text-sm">Clear selection</span>
                </label>
              )}
            </div>
            {form.profile.paymentType === 'FIXED_PAYMENT' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fixed Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter fixed amount"
                  value={form.profile.paymentValue}
                  onChange={(e) => setForm(f => ({ ...f, profile: { ...f.profile, paymentValue: e.target.value } }))}
                  className={inputCls}
                />
              </div>
            )}
            {form.profile.paymentType === 'REVENUE_PERCENTAGE' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Revenue Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Enter percentage"
                  value={form.profile.paymentValue}
                  onChange={(e) => setForm(f => ({ ...f, profile: { ...f.profile, paymentValue: e.target.value } }))}
                  className={inputCls}
                />
              </div>
            )}
            {form.profile.paymentType === 'PER_SESSION_PAYOUT' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Per Session Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter per-session amount"
                  value={form.profile.paymentValue}
                  onChange={(e) => setForm(f => ({ ...f, profile: { ...f.profile, paymentValue: e.target.value } }))}
                  className={inputCls}
                />
              </div>
            )}
          </div>
        )}

        {mutation.isError && <p className="text-red-500 text-xs mt-3">Failed to save coach. Please try again.</p>}

        {/* Navigation */}
        <div className="flex gap-3 pt-5">
          {currentStep > 1 ? (
            <button type="button" onClick={handleBack} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          )}
          {currentStep < COACH_STEP_LABELS.length ? (
            <button type="button" onClick={handleNext} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save Changes' : 'Add Coach')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachDetailModal({ coach, onClose }: { coach: Coach; onClose: () => void }) {
  const p = coach.profile;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
              {coach.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{coach.name}</h3>
              <p className="text-sm text-gray-500">{coach.phone}</p>
              {coach.email && <p className="text-xs text-gray-400">{coach.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {(coach.state || coach.district || coach.city || coach.region) && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {coach.state && <div><span className="text-gray-400 text-xs">State</span><p className="font-medium">{coach.state}</p></div>}
              {coach.district && <div><span className="text-gray-400 text-xs">District</span><p className="font-medium">{coach.district}</p></div>}
              {coach.city && <div><span className="text-gray-400 text-xs">City</span><p className="font-medium">{coach.city}</p></div>}
              {coach.region && <div><span className="text-gray-400 text-xs">Region</span><p className="font-medium">{coach.region}</p></div>}
            </div>
          </div>
        )}

        {coach.sports && coach.sports.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assigned Sports</p>
            <div className="flex flex-wrap gap-2">
              {coach.sports.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  {s.icon && <span>{s.icon}</span>}
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {p?.sportSpecialization && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sport Specialization</p>
            <p className="text-sm text-gray-800">{p.sportSpecialization}</p>
          </div>
        )}

        {p?.playingLevels && p.playingLevels.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Playing Level</p>
            <div className="flex flex-wrap gap-1.5">
              {p.playingLevels.map((l) => (
                <span key={l} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">{l}</span>
              ))}
            </div>
          </div>
        )}

        {p?.keySkills && p.keySkills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {p.keySkills.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {p?.expectedSalary && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected Salary</p>
            <p className="text-sm text-gray-800">₹{p.expectedSalary}</p>
            {p.joiningAvailability && <p className="text-xs text-gray-500 mt-0.5">Available: {p.joiningAvailability}</p>}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Assigned Batches ({coach.batches?.length ?? 0})
          </p>
          {coach.batches && coach.batches.length > 0 ? (
            <div className="space-y-2">
              {coach.batches.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{b.name}</span>
                  {b.sport && <span className="text-xs text-gray-400">{b.sport.name}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No batches assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoachesPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coach | undefined>();
  const [viewing, setViewing] = useState<Coach | undefined>();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const coachesQueryKey = isSuperAdmin ? (['coaches-global'] as const) : (['coaches', venueId] as const);

  const { data: coaches = [], isLoading } = useQuery<Coach[]>({
    queryKey: coachesQueryKey,
    queryFn: isSuperAdmin
      ? () => api.get('/coaches').then(r => r.data)
      : () => api.get(`/venues/${venueId}/coaches`).then(r => r.data),
    enabled: isSuperAdmin || !!venueId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      isSuperAdmin
        ? api.patch(`/coaches/${id}`, { status })
        : api.patch(`/venues/${venueId}/coaches/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coachesQueryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      isSuperAdmin
        ? api.delete(`/coaches/${id}`)
        : api.delete(`/venues/${venueId}/coaches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coachesQueryKey }),
  });

  const filtered = useMemo(() => {
    return coaches.filter(c => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      return true;
    });
  }, [coaches, search, filterStatus]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coaches</h2>
          <p className="text-gray-500 text-sm">{filtered.length} of {coaches.length} coaches</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus size={16} /> Add Coach
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} /><span>Filter:</span>
        </div>
        <select
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus('')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading coaches...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <User size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">
              {search || filterStatus ? 'No coaches match your filters.' : 'No coaches yet. Add your first coach.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Coach</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Batches</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => {
                const batchCount = c._count?.batches ?? c.batches?.length ?? 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-semibold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <button
                          onClick={() => setViewing(c)}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left"
                        >
                          {c.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{batchCount} batch{batchCount !== 1 ? 'es' : ''}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => statusMutation.mutate({ id: c.id, status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                        title={c.status === 'ACTIVE' ? 'Click to deactivate' : 'Click to activate'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${c.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${c.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {isSuperAdmin && (
                          <Link
                            href={`/coaches/${c.id}`}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="View coach details"
                          >
                            <Eye size={15} />
                          </Link>
                        )}
                        <button
                          onClick={() => { setEditing(c); setShowModal(true); }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remove coach "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CoachModal
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          venueId={isSuperAdmin ? undefined : venueId}
          existing={editing}
          queryKey={coachesQueryKey}
        />
      )}

      {viewing && <CoachDetailModal coach={viewing} onClose={() => setViewing(undefined)} />}
    </div>
  );
}
