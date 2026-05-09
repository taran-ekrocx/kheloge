'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { ArrowLeft, User, Calendar, CreditCard, Camera, FileText, Download, Pencil, X, Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type Tab = 'profile' | 'attendance' | 'payments';

async function downloadPdf(url: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kheloge_access_token') : '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const resp = await fetch(`${apiUrl}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return;
  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objUrl);
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isCoach = role === 'COACH';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', dob: '', address: '', city: '', state: '', district: '', region: '', medicalNotes: '', status: '', sportsInterestedIn: '', sportInterest: '', trainingLevel: '' });
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [sportsSearch, setSportsSearch] = useState('');
  const [sportsDropdownOpen, setSportsDropdownOpen] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [addBatchId, setAddBatchId] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [guardianErrors, setGuardianErrors] = useState<Record<string, string>>({});
  const [photoLoading, setPhotoLoading] = useState(false);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => (isSuperAdmin || isCoach)
      ? api.get(`/students/${id}`).then((r) => r.data)
      : api.get(`/venues/${venueId}/students/${id}`).then((r) => r.data),
    enabled: !!id && (isSuperAdmin || isCoach || !!venueId),
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ['attendance-stats', id],
    queryFn: () => api.get(`/attendance/students/${id}/stats`).then((r) => r.data),
    enabled: tab === 'attendance' && !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/payments/students/${id}/invoices`).then((r) => r.data),
    enabled: tab === 'payments' && !!id,
  });

  const studentBase = (isSuperAdmin || isCoach)
    ? `/students/${id}`
    : `/venues/${venueId}/students/${id}`;
  const studentPatchBase = isCoach
    ? `/coaches/me/students/${id}`
    : studentBase;

  const { data: allBatches = [] } = useQuery<{ id: string; name: string; sport: { id: string; name: string }; venue?: { id: string; name: string } }[]>({
    queryKey: isCoach ? ['coach-batches'] : isSuperAdmin ? ['batches-global'] : ['batches', venueId],
    queryFn: isCoach
      ? () => api.get('/coaches/me/batches?status=active').then((r) => r.data)
      : isSuperAdmin
        ? () => api.get('/batches?status=active').then((r) => r.data)
        : () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: editingProfile && (isCoach || isSuperAdmin || !!venueId),
  });

  const { data: sports = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
    enabled: editingProfile,
  });

  const coachEnrollBase = `/coaches/me/students/${id}`;

  const isValidPhone = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/[\s\-+]/g, '').replace(/^91/, ''));
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function validateEditForm(): boolean {
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = 'Full name is required';
    if (!editForm.dob) errs.dob = 'Date of birth is required';
    if (!editForm.phone.trim()) errs.phone = 'Student mobile number is required';
    else if (!isValidPhone(editForm.phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    if (editForm.email && !isValidEmail(editForm.email)) errs.email = 'Enter a valid email address';
    if (!editForm.sportInterest) errs.sportInterest = 'Sport applied for is required';
    const activeEnrollments = student?.enrollments?.filter((e: { isActive: boolean }) => e.isActive) ?? [];
    if (activeEnrollments.length === 0) errs.batch = 'Student must be enrolled in at least one batch';
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateGuardianForm(): boolean {
    const errs: Record<string, string> = {};
    if (!guardianForm.name.trim()) errs.name = 'Name is required';
    if (!guardianForm.phone.trim()) errs.phone = 'Phone is required';
    else if (!isValidPhone(guardianForm.phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    if (!guardianForm.email.trim()) errs.email = 'Email is required';
    else if (!isValidEmail(guardianForm.email)) errs.email = 'Enter a valid email address';
    setGuardianErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.patch(studentPatchBase, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setEditingProfile(false);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (batchId: string) => isCoach
      ? api.post(`${coachEnrollBase}/enrol`, { batchId })
      : api.post(`${studentBase}/enrol`, { batchId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student', id] }),
  });

  const unenrollMutation = useMutation({
    mutationFn: (batchId: string) => isCoach
      ? api.delete(`${coachEnrollBase}/enroll/${batchId}`)
      : api.delete(`${studentBase}/enroll/${batchId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student', id] }),
  });

  const [guardianForm, setGuardianForm] = useState({ name: '', phone: '', email: '', relation: 'Guardian', isPrimary: false });
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editGuardianForm, setEditGuardianForm] = useState({ name: '', phone: '', email: '', relation: '' });

  const addGuardianMutation = useMutation({
    mutationFn: (data: typeof guardianForm) => api.post(`${studentBase}/guardians`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setGuardianForm({ name: '', phone: '', email: '', relation: 'Guardian', isPrimary: false });
      setGuardianErrors({});
    },
  });

  const updateGuardianMutation = useMutation({
    mutationFn: ({ guardianId, data }: { guardianId: string; data: typeof editGuardianForm }) =>
      api.patch(`${studentBase}/guardians/${guardianId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setEditingGuardianId(null);
    },
  });

  const deleteGuardianMutation = useMutation({
    mutationFn: (guardianId: string) => api.delete(`${studentBase}/guardians/${guardianId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student', id] }),
  });

  function startEditProfile() {
    setEditForm({
      name: student?.name || '',
      phone: student?.phone || '',
      email: student?.email || '',
      dob: student?.dob ? dayjs(student.dob).format('YYYY-MM-DD') : '',
      address: student?.address || '',
      city: student?.city || '',
      state: student?.state || '',
      district: student?.district || '',
      region: student?.region || '',
      medicalNotes: student?.medicalNotes || '',
      status: student?.status || '',
      sportsInterestedIn: student?.sportsInterestedIn || '',
      sportInterest: student?.sportInterest || '',
      trainingLevel: student?.trainingLevel || '',
    });
    setSelectedVenueId('');
    setSportsSearch('');
    setSportsDropdownOpen(false);
    setVenueSearch('');
    setVenueDropdownOpen(false);
    setEditingProfile(true);
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`${studentBase}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
    } finally {
      setPhotoLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleIdCardDownload = async () => {
    setIdCardLoading(true);
    try {
      await downloadPdf(`${studentBase}/id-card`, `id-card-${student?.name?.replace(/\s+/g, '-') ?? id}.pdf`);
    } finally {
      setIdCardLoading(false);
    }
  };

  const handleInvoicePdf = async (invoiceId: string, invoiceNumber: string) => {
    setInvoiceLoading(invoiceId);
    try {
      await downloadPdf(`/payments/invoices/${invoiceId}/pdf`, `invoice-${invoiceNumber}.pdf`);
    } finally {
      setInvoiceLoading(null);
    }
  };

  if (isLoading || (!isSuperAdmin && !isCoach && !venueId)) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!student) return <div className="p-8 text-gray-400">Student not found.</div>;

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'attendance', label: 'Attendance', icon: Calendar },
    { key: 'payments', label: 'Payments', icon: CreditCard },
  ] as const;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/students" className="text-gray-400 hover:text-gray-700 mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-4 flex-1">
          {/* Photo */}
          <div className="relative group">
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <User size={24} className="text-gray-400" />
              </div>
            )}
            {!isCoach && (
              <>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoLoading}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Camera size={16} className="text-white" />
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
            <p className="text-gray-500 text-sm">{student.phone} · {student.status}</p>
          </div>
          {/* ID Card button */}
          <button
            onClick={handleIdCardDownload}
            disabled={idCardLoading}
            className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <CreditCard size={15} />
            {idCardLoading ? 'Generating...' : 'ID Card PDF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Personal Information</p>
              {editingProfile ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <X size={13} /> Cancel
                  </button>
                  <button
                    onClick={() => { if (validateEditForm()) updateMutation.mutate(editForm); }}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    <Check size={13} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditProfile}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
            </div>

            {!editingProfile ? (
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400">Name</p><p className="font-medium">{student.name}</p></div>
                <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{student.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Email</p><p className="font-medium">{student.email || '—'}</p></div>
                <div>
                  <p className="text-xs text-gray-400">Date of Birth</p>
                  <p className="font-medium">{student.dob ? dayjs(student.dob).format('DD MMM YYYY') : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <p className="font-medium">{student.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Enrolled At</p>
                  <p className="font-medium">{student.enrolledAt ? dayjs(student.enrolledAt).format('DD MMM YYYY') : '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Address</p>
                  <p className="font-medium">{student.address || '—'}</p>
                </div>
                <div><p className="text-xs text-gray-400">City</p><p className="font-medium">{student.city || '—'}</p></div>
                <div><p className="text-xs text-gray-400">State</p><p className="font-medium">{student.state || '—'}</p></div>
                <div><p className="text-xs text-gray-400">District</p><p className="font-medium">{student.district || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Region</p><p className="font-medium">{student.region || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Training Level</p><p className="font-medium">{student.trainingLevel || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Sports Interested In</p><p className="font-medium">{student.sportsInterestedIn || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Sport Applied For</p><p className="font-medium">{student.sportInterest || '—'}</p></div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Medical Notes</p>
                  <p className="font-medium">{student.medicalNotes || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Name</label>
                  <input
                    value={editForm.name}
                    onChange={e => { setEditForm(f => ({ ...f, name: e.target.value })); setEditErrors(p => ({ ...p, name: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editErrors.name ? 'border-red-400' : ''}`}
                  />
                  {editErrors.name && <p className="text-red-500 text-xs mt-1">{editErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phone *</label>
                  <input
                    value={editForm.phone}
                    onChange={e => { setEditForm(f => ({ ...f, phone: e.target.value })); setEditErrors(p => ({ ...p, phone: '' })); }}
                    maxLength={10}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editErrors.phone ? 'border-red-400' : ''}`}
                  />
                  {editErrors.phone && <p className="text-red-500 text-xs mt-1">{editErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => { setEditForm(f => ({ ...f, email: e.target.value })); setEditErrors(p => ({ ...p, email: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editErrors.email ? 'border-red-400' : ''}`}
                  />
                  {editErrors.email && <p className="text-red-500 text-xs mt-1">{editErrors.email}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date of Birth *</label>
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={e => { setEditForm(f => ({ ...f, dob: e.target.value })); setEditErrors(p => ({ ...p, dob: '' })); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editErrors.dob ? 'border-red-400' : ''}`}
                  />
                  {editErrors.dob && <p className="text-red-500 text-xs mt-1">{editErrors.dob}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Status</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {['ENQUIRY', 'TRIAL', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'ON_HOLD'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Address</label>
                  <input
                    value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">City</label>
                  <input
                    value={editForm.city}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">State</label>
                  <input
                    value={editForm.state}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">District</label>
                  <input
                    value={editForm.district}
                    onChange={e => setEditForm(f => ({ ...f, district: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Region</label>
                  <input
                    value={editForm.region}
                    onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Medical Notes</label>
                  <textarea
                    value={editForm.medicalNotes}
                    onChange={e => setEditForm(f => ({ ...f, medicalNotes: e.target.value }))}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Training Level</label>
                  <select
                    value={editForm.trainingLevel}
                    onChange={e => setEditForm(f => ({ ...f, trainingLevel: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select —</option>
                    {['Beginner', 'Intermediate', 'Advanced'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Sports Interested In</label>
                  <div className="relative">
                    <div
                      className="border rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between min-h-[38px]"
                      onClick={() => setSportsDropdownOpen(o => !o)}
                    >
                      <span className="text-gray-700 truncate">
                        {editForm.sportsInterestedIn || <span className="text-gray-400">Select sports...</span>}
                      </span>
                      <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                    {sportsDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[9]" onClick={() => setSportsDropdownOpen(false)} />
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                          <div className="p-2 border-b">
                            <input
                              autoFocus
                              placeholder="Search sports..."
                              value={sportsSearch}
                              onChange={e => setSportsSearch(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="overflow-y-auto max-h-36">
                            {sports
                              .filter(s => s.name.toLowerCase().includes(sportsSearch.toLowerCase()))
                              .map(s => {
                                const selected = editForm.sportsInterestedIn.split(',').map(v => v.trim()).filter(Boolean).includes(s.name);
                                return (
                                  <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => {
                                        const current = editForm.sportsInterestedIn.split(',').map(v => v.trim()).filter(Boolean);
                                        const next = selected ? current.filter(v => v !== s.name) : [...current, s.name];
                                        const nextStr = next.join(', ');
                                        const sportAppliedStillValid = next.length === 0 || next.includes(editForm.sportInterest);
                                        setEditForm(f => ({
                                          ...f,
                                          sportsInterestedIn: nextStr,
                                          sportInterest: sportAppliedStillValid ? f.sportInterest : '',
                                        }));
                                        if (!sportAppliedStillValid) {
                                          setSelectedVenueId('');
                                          setAddBatchId('');
                                        }
                                        setEditErrors(p => ({ ...p, sportInterest: '' }));
                                      }}
                                      onClick={e => e.stopPropagation()}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">{s.name}</span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sport Applied For *</label>
                  <select
                    value={editForm.sportInterest}
                    onChange={e => {
                      setEditForm(f => ({ ...f, sportInterest: e.target.value }));
                      setSelectedVenueId('');
                      setAddBatchId('');
                      setEditErrors(p => ({ ...p, sportInterest: '' }));
                    }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${editErrors.sportInterest ? 'border-red-400' : ''}`}
                  >
                    <option value="">— Select sport —</option>
                    {(() => {
                      const interestedNames = editForm.sportsInterestedIn.split(',').map(v => v.trim()).filter(Boolean);
                      const filtered = interestedNames.length > 0
                        ? sports.filter(s => interestedNames.includes(s.name))
                        : sports;
                      return filtered.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ));
                    })()}
                  </select>
                  {editErrors.sportInterest && <p className="text-red-500 text-xs mt-1">{editErrors.sportInterest}</p>}
                </div>
                {editForm.sportInterest && (() => {
                  const venueMap = new Map<string, { id: string; name: string }>();
                  allBatches
                    .filter(b => b.sport?.name === editForm.sportInterest && b.venue)
                    .forEach(b => { if (b.venue) venueMap.set(b.venue.id, b.venue); });
                  const availableVenues = Array.from(venueMap.values());
                  if (!availableVenues.length) return null;
                  return (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Venue</label>
                      <div className="relative">
                        <div
                          className="border rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between min-h-[38px]"
                          onClick={() => setVenueDropdownOpen(o => !o)}
                        >
                          <span className={selectedVenueId ? 'text-gray-700' : 'text-gray-400'}>
                            {selectedVenueId
                              ? availableVenues.find(v => v.id === selectedVenueId)?.name ?? 'Select venue...'
                              : 'Select venue...'}
                          </span>
                          <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                        {venueDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-[9]" onClick={() => setVenueDropdownOpen(false)} />
                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                              <div className="p-2 border-b">
                                <input
                                  autoFocus
                                  placeholder="Search venues..."
                                  value={venueSearch}
                                  onChange={e => setVenueSearch(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="overflow-y-auto max-h-36">
                                {availableVenues
                                  .filter(v => v.name.toLowerCase().includes(venueSearch.toLowerCase()))
                                  .map(v => (
                                    <div
                                      key={v.id}
                                      className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 ${selectedVenueId === v.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                      onClick={() => {
                                        setSelectedVenueId(v.id === selectedVenueId ? '' : v.id);
                                        setAddBatchId('');
                                        setVenueDropdownOpen(false);
                                        setVenueSearch('');
                                      }}
                                    >
                                      {v.name}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {updateMutation.isError && (
                  <p className="col-span-2 text-xs text-red-500">Failed to save. Please try again.</p>
                )}
              </div>
            )}

            <hr className="border-gray-100" />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Enrolled Batches {editingProfile && <span className="text-red-500">*</span>}</p>
              {editErrors.batch && <p className="text-red-500 text-xs mb-2">{editErrors.batch}</p>}
              {student.enrollments?.filter((e: { isActive: boolean }) => e.isActive).length > 0 ? (
                <ul className="space-y-2">
                  {student.enrollments
                    .filter((e: { isActive: boolean }) => e.isActive)
                    .map((e: { id: string; batchId: string; batch: { id: string; name: string; sport: { name: string } } }) => (
                      <li key={e.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="font-medium text-sm">{e.batch?.name}</span>
                        <span className="text-xs text-gray-400">{e.batch?.sport?.name}</span>
                        {editingProfile && (
                          <button
                            onClick={() => unenrollMutation.mutate(e.batch?.id ?? e.batchId)}
                            disabled={unenrollMutation.isPending}
                            className="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Not enrolled in any batch.</p>
              )}
              {editingProfile && allBatches.length > 0 && (() => {
                const enrolledBatchIds = new Set(
                  student.enrollments?.filter((e: { isActive: boolean }) => e.isActive).map((e: { batchId: string }) => e.batchId) ?? []
                );
                const available = allBatches.filter(b => {
                  if (enrolledBatchIds.has(b.id)) return false;
                  if (editForm.sportInterest && b.sport?.name !== editForm.sportInterest) return false;
                  if (selectedVenueId && (!b.venue || b.venue.id !== selectedVenueId)) return false;
                  return true;
                });
                if (!available.length) return null;
                return (
                  <div className="mt-2 flex gap-2">
                    <select
                      value={addBatchId}
                      onChange={e => setAddBatchId(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="" disabled>Add to batch…</option>
                      {available.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { if (addBatchId) { enrollMutation.mutate(addBatchId); setAddBatchId(''); } }}
                      disabled={enrollMutation.isPending || !addBatchId}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                );
              })()}
            </div>
            {(student.guardians?.length > 0 || (editingProfile && !isCoach)) && (
              <div>
                <hr className="border-gray-100 mb-4" />
                <p className="text-sm font-medium text-gray-700 mb-2">Parent / Guardian Contact</p>
                <div className="space-y-2">
                  {student.guardians?.map((g: { id: string; name: string; relation: string; phone: string; email?: string }) => (
                    <div key={g.id}>
                      {editingProfile && !isCoach && editingGuardianId === g.id ? (
                        <div className="p-2 bg-gray-50 rounded-lg space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              placeholder="Name"
                              value={editGuardianForm.name}
                              onChange={e => setEditGuardianForm(f => ({ ...f, name: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              placeholder="Phone"
                              value={editGuardianForm.phone}
                              onChange={e => setEditGuardianForm(f => ({ ...f, phone: e.target.value }))}
                              maxLength={10}
                              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              placeholder="Email"
                              value={editGuardianForm.email}
                              onChange={e => setEditGuardianForm(f => ({ ...f, email: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              placeholder="Relation"
                              value={editGuardianForm.relation}
                              onChange={e => setEditGuardianForm(f => ({ ...f, relation: e.target.value }))}
                              className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateGuardianMutation.mutate({ guardianId: g.id, data: editGuardianForm })}
                              disabled={updateGuardianMutation.isPending}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                            >Save</button>
                            <button onClick={() => setEditingGuardianId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
                          <span className="font-medium text-gray-900">{g.name}</span>
                          <span className="text-xs text-gray-400 capitalize">{g.relation}</span>
                          <span className="text-gray-600">{g.phone}</span>
                          {editingProfile && !isCoach && (
                            <div className="ml-auto flex gap-2">
                              <button
                                onClick={() => { setEditingGuardianId(g.id); setEditGuardianForm({ name: g.name, phone: g.phone, email: g.email || '', relation: g.relation }); }}
                                className="text-xs text-blue-500 hover:text-blue-700"
                              >Edit</button>
                              <button
                                onClick={() => deleteGuardianMutation.mutate(g.id)}
                                disabled={deleteGuardianMutation.isPending}
                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                              >Remove</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {editingProfile && !isCoach && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Add Guardian</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          placeholder="Name *"
                          value={guardianForm.name}
                          onChange={e => { setGuardianForm(f => ({ ...f, name: e.target.value })); setGuardianErrors(p => ({ ...p, name: '' })); }}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${guardianErrors.name ? 'border-red-400' : ''}`}
                        />
                        {guardianErrors.name && <p className="text-red-500 text-xs mt-0.5">{guardianErrors.name}</p>}
                      </div>
                      <div>
                        <input
                          placeholder="Phone *"
                          value={guardianForm.phone}
                          onChange={e => { setGuardianForm(f => ({ ...f, phone: e.target.value })); setGuardianErrors(p => ({ ...p, phone: '' })); }}
                          maxLength={10}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${guardianErrors.phone ? 'border-red-400' : ''}`}
                        />
                        {guardianErrors.phone && <p className="text-red-500 text-xs mt-0.5">{guardianErrors.phone}</p>}
                      </div>
                      <div>
                        <input
                          type="email"
                          placeholder="Email *"
                          value={guardianForm.email}
                          onChange={e => { setGuardianForm(f => ({ ...f, email: e.target.value })); setGuardianErrors(p => ({ ...p, email: '' })); }}
                          className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${guardianErrors.email ? 'border-red-400' : ''}`}
                        />
                        {guardianErrors.email && <p className="text-red-500 text-xs mt-0.5">{guardianErrors.email}</p>}
                      </div>
                      <input
                        placeholder="Relation"
                        value={guardianForm.relation}
                        onChange={e => setGuardianForm(f => ({ ...f, relation: e.target.value }))}
                        className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {addGuardianMutation.isError && <p className="text-red-500 text-xs">Failed to add guardian. Please try again.</p>}
                    <button
                      onClick={() => { if (validateGuardianForm()) addGuardianMutation.mutate(guardianForm); }}
                      disabled={addGuardianMutation.isPending}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add Guardian
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attendance tab */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            {attendanceStats ? (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
                    <p className="text-sm text-gray-500">Present</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
                    <p className="text-sm text-gray-500">Absent</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-600">{attendanceStats.percentage}%</p>
                    <p className="text-sm text-gray-500">Attendance</p>
                  </div>
                </div>
                {attendanceStats.byBatch && Object.keys(attendanceStats.byBatch).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">By Batch</p>
                    <div className="space-y-2">
                      {Object.entries(attendanceStats.byBatch).map(([batchName, stats]: [string, unknown]) => {
                        const s = stats as { present: number; absent: number; percentage: number };
                        return (
                          <div key={batchName} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                            <span className="font-medium flex-1">{batchName}</span>
                            <span className="text-green-600">{s.present}P</span>
                            <span className="text-red-600">{s.absent}A</span>
                            <span className="text-blue-600 font-medium">{s.percentage}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">Loading attendance stats...</p>
            )}
          </div>
        )}

        {/* Payments tab */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-gray-400 text-sm">No invoices found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500 border-b">
                  <tr>
                    <th className="pb-2">Invoice #</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Due Date</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv: { id: string; invoiceNumber: string; amount: string; dueDate: string; status: string }) => (
                    <tr key={inv.id}>
                      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="py-2">₹{Number(inv.amount).toLocaleString()}</td>
                      <td className="py-2">{dayjs(inv.dueDate).format('DD MMM YYYY')}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleInvoicePdf(inv.id, inv.invoiceNumber)}
                          disabled={invoiceLoading === inv.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50 ml-auto"
                        >
                          {invoiceLoading === inv.id ? (
                            <span>Downloading...</span>
                          ) : (
                            <>
                              <FileText size={12} />
                              <Download size={12} />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
