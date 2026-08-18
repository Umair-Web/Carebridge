import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import { useAdmissions, useHospitalPipeline } from '../hooks/useReferrals';
import { useQueryClient } from '@tanstack/react-query';
import Loader from '../components/Loader';
import { formatDob, ageLabel } from '../utils/dob';



const HospitalAdmissions = () => {
  const queryClient = useQueryClient();
  const { data: pipeline = [], isLoading: pipelineLoading } = useHospitalPipeline();
  const { data: admissions = [], isLoading: admissionsLoading } = useAdmissions();
  
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({
    services: [{ description: '', amount: '' }],
    billTotalPaisa: '0',
    paymentMethod: 'manual',
    paymentReference: '',
    patientBillFileUrl: '',
  });
  const [uploadingBill, setUploadingBill] = useState(false);

  const addServiceRow = () => {
    const updatedServices = [...(form.services || []), { description: '', amount: '' }];
    const total = updatedServices.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    setForm({
      ...form,
      services: updatedServices,
      billTotalPaisa: String(total),
    });
  };

  const updateServiceRow = (index, field, value) => {
    const updatedServices = (form.services || []).map((s, idx) => {
      if (idx === index) {
        return { ...s, [field]: value };
      }
      return s;
    });
    const total = updatedServices.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    setForm({
      ...form,
      services: updatedServices,
      billTotalPaisa: String(total),
    });
  };

  const removeServiceRow = (index) => {
    const updatedServices = (form.services || []).filter((_, idx) => idx !== index);
    const total = updatedServices.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    setForm({
      ...form,
      services: updatedServices,
      billTotalPaisa: String(total || 0),
    });
  };

  const [admittingReferral, setAdmittingReferral] = useState(null);
  const [admitForm, setAdmitForm] = useState({
    roomNumber: '',
    bedNumber: '',
    admissionDepartment: '',
    treatingDoctorId: '',
  });
  const [hospitalInfo, setHospitalInfo] = useState(null);
  const [doctorsList, setDoctorsList] = useState([]);
  const [editingAdmission, setEditingAdmission] = useState(null);
  const [editAdmissionForm, setEditAdmissionForm] = useState({
    roomNumber: '',
    bedNumber: '',
    admissionDepartment: '',
    treatingDoctorId: '',
  });

  const loadDoctors = async () => {
    try {
      const doctorsRes = await api.get('/hospitals/doctors');
      if (doctorsRes.data.success) {
        const list = doctorsRes.data.data || [];
        setDoctorsList(list.filter((d) => d.isAvailable !== false));
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
      toast.error(err.response?.data?.message || 'Could not load doctors list');
    }
  };

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const profileRes = await api.get('/profile/me');
        if (profileRes.data.success) {
          setHospitalInfo(profileRes.data.data.profile);
        }
        await loadDoctors();
      } catch (err) {
        console.error('Failed to load hospital profile:', err);
      }
    };
    fetchInfo();
  }, []);

  const handleStartAdmission = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!admitForm.roomNumber.trim() || !admitForm.bedNumber.trim() || !admitForm.admissionDepartment || !admitForm.treatingDoctorId) {
      return toast.error('Room Number, Bed Number, Department, and Doctor are all compulsory.');
    }
    try {
      await api.post('/hospitals/admissions', {
        referralId: admittingReferral._id,
        roomNumber: admitForm.roomNumber.trim(),
        bedNumber: admitForm.bedNumber.trim(),
        admissionDepartment: admitForm.admissionDepartment,
        treatingDoctorId: admitForm.treatingDoctorId,
      });
      toast.success('Admission started successfully!');
      setAdmittingReferral(null);
      setAdmitForm({ roomNumber: '', bedNumber: '', admissionDepartment: '', treatingDoctorId: '' });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not start admission');
    }
  };

  const openEditAdmission = (admission) => {
    setEditingAdmission(admission);
    setEditAdmissionForm({
      roomNumber: admission.roomNumber || '',
      bedNumber: admission.bedNumber || '',
      admissionDepartment: admission.admissionDepartment || '',
      treatingDoctorId: admission.treatingDoctorId?._id || admission.treatingDoctorId || '',
    });
  };

  const saveAdmissionPlacement = async (e) => {
    e.preventDefault();
    if (!editingAdmission) return;
    if (
      !editAdmissionForm.roomNumber.trim() ||
      !editAdmissionForm.bedNumber.trim() ||
      !editAdmissionForm.admissionDepartment ||
      !editAdmissionForm.treatingDoctorId
    ) {
      return toast.error('Room, bed, department, and doctor are required.');
    }
    try {
      await api.patch(`/hospitals/admissions/${editingAdmission._id}`, {
        roomNumber: editAdmissionForm.roomNumber.trim(),
        bedNumber: editAdmissionForm.bedNumber.trim(),
        admissionDepartment: editAdmissionForm.admissionDepartment,
        treatingDoctorId: editAdmissionForm.treatingDoctorId,
      });
      toast.success('Admission placement updated');
      setEditingAdmission(null);
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update admission');
    }
  };

  const saveAdmission = async (id) => {
    try {
      const servicesPayload = (form.services || [])
        .filter(s => s.description.trim())
        .map(s => ({
          description: s.description.trim(),
          amountPaisa: Math.round((Number(s.amount) || 0) * 100),
        }));
      await api.patch(`/hospitals/admissions/${id}`, {
        services: servicesPayload,
        billTotalPaisa: Math.round(Number(form.billTotalPaisa) * 100),
        paymentMethod: 'manual',
        patientBillFileUrl: form.patientBillFileUrl || undefined,
      });
      toast.success('Billing draft saved.');
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  const complete = async (id) => {
    try {
      const servicesPayload = (form.services || [])
        .filter(s => s.description.trim())
        .map(s => ({
          description: s.description.trim(),
          amountPaisa: Math.round((Number(s.amount) || 0) * 100),
        }));
      // 1. Always save current form data first to ensure DB has the latest bill total
      await api.patch(`/hospitals/admissions/${id}`, {
        services: servicesPayload,
        billTotalPaisa: Math.round(Number(form.billTotalPaisa) * 100),
        paymentMethod: 'manual',
        patientBillFileUrl: form.patientBillFileUrl || undefined,
      });

      // 2. Finalize
      await api.post(`/hospitals/admissions/${id}/complete`);
      toast.success('Case closed — consultant payout triggered.');
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    } catch (e) {
      console.error('Finalization failed:', e);
      toast.error(e.response?.data?.message || 'Finalization failed. Ensure bill total is set.');
    }
  };

  if (pipelineLoading || admissionsLoading) {
    return <Loader message="Loading admissions..." />;
  }

  const needsAdmission = pipeline.filter((r) => r.status === 'accepted' && !r.admission);

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
          <ClipboardList className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admissions & billing</h1>
          <p className="text-slate-500 text-sm mt-1">
            Admit accepted referrals, record services in PKR, confirm payment (SRS §4.1, §12).
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Awaiting admission ({needsAdmission.length})
        </h2>
        {needsAdmission.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
            No accepted referrals pending admission.
          </p>
        ) : (
          <ul className="space-y-3">
            {needsAdmission.map((r) => (
              <li key={r._id}
                className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-wrap justify-between gap-4 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-base flex items-center justify-center shrink-0">
                      {r.patientName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{r.patientName}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{r.referralCode}</p>
                      {r.assignedDepartment && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {r.assignedDepartment}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === `pre-${r._id}` ? null : `pre-${r._id}`)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                      title="View patient details"
                    >
                      {expanded === `pre-${r._id}` ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdmittingReferral(r);
                        setAdmitForm({
                          roomNumber: '',
                          bedNumber: '',
                          admissionDepartment: r.assignedDepartment || r.department || '',
                          treatingDoctorId: r.targetDoctorId?._id || r.targetDoctorId || '',
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"
                    >
                      Start admission
                    </button>
                  </div>
                </div>

                {/* Expandable patient info */}
                {expanded === `pre-${r._id}` && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date of Birth</p><p className="font-medium text-slate-700">{formatDob(r.dateOfBirth) || '—'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Age / Gender</p><p className="font-medium text-slate-700">{ageLabel(r)} · {r.gender}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone</p><p className="font-medium text-slate-700">{r.phone || '—'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Urgency</p><p className="font-medium text-slate-700 capitalize">{r.urgency}</p></div>
                    {r.symptomsText && (
                      <div className="col-span-2 sm:col-span-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Symptoms</p>
                        <p className="text-slate-700">{r.symptomsText}</p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Active & billing
        </h2>
        {admissions.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">No admission records yet.</p>
        ) : (
          <ul className="space-y-4">
            {admissions.map((a) => (
              <li
                key={a._id}
                className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{a.referralId?.patientName}</p>
                    <p className="text-xs font-mono text-slate-500">{a.referralId?.referralCode}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      a.status === 'billed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>

                {a.admissionDepartment && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Admitted Department</span>
                      <span className="font-semibold text-slate-700">{a.admissionDepartment}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Treating Doctor</span>
                      <span className="font-semibold text-slate-700">Dr. {a.treatingDoctorId?.name?.replace(/^Dr\.\s*/i, '') || '—'} ({a.treatingDoctorId?.specialty || 'N/A'})</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Room & Bed Number</span>
                      <span className="font-semibold text-slate-700">Room: {a.roomNumber} · Bed: {a.bedNumber}</span>
                    </div>
                    {a.status === 'active' && (
                      <div className="col-span-full pt-2">
                        <button
                          type="button"
                          onClick={() => openEditAdmission(a)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          Edit room / bed / doctor
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {a.status !== 'billed' && (
                  <>
                    {expanded === a._id ? (
                      <div className="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                          <div>
                            <h3 className="font-bold text-slate-800">Finalize Billing & Payout</h3>
                            <p className="text-xs text-slate-500">Record services and confirm payment method</p>
                          </div>
                          <div className="text-right bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Status</p>
                            <p className="font-bold text-blue-700">Billing in Progress</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Billing Services & Procedures</label>
                            {(form.services || []).map((service, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="Service / Procedure description (e.g. Lab test, Consultation)"
                                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  value={service.description}
                                  onChange={(e) => updateServiceRow(index, 'description', e.target.value)}
                                />
                                <input
                                  type="number"
                                  placeholder="PKR"
                                  className="w-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-right font-semibold"
                                  value={service.amount}
                                  onChange={(e) => updateServiceRow(index, 'amount', e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeServiceRow(index)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 font-bold"
                                  title="Remove Service"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={addServiceRow}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                            >
                              + Add Billing Service Line
                            </button>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs font-semibold text-slate-600">Total Patient Bill (PKR) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                readOnly
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-bold text-slate-800 bg-slate-50 outline-none transition-all shadow-sm cursor-not-allowed"
                                placeholder="0.00"
                                value={form.billTotalPaisa}
                              />
                            </div>
                          <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-semibold text-slate-600">Patient Bill Document (Image/PDF) <span className="text-red-500">*</span></label>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700">
                                {uploadingBill ? 'Uploading...' : 'Upload File'}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  disabled={uploadingBill}
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    setUploadingBill(true);
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    try {
                                      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                                      if (res.data.success) {
                                        setForm({ ...form, patientBillFileUrl: res.data.url });
                                        toast.success('Bill document uploaded!');
                                      }
                                    } catch (err) {
                                      toast.error('Failed to upload document');
                                    } finally {
                                      setUploadingBill(false);
                                    }
                                  }}
                                />
                              </label>
                              {form.patientBillFileUrl && (
                                <a href={form.patientBillFileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline font-bold">
                                  View Uploaded Bill
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                        <div className="mt-6 flex flex-wrap gap-3 items-center justify-end border-t border-slate-200 pt-4">
                          <button
                            type="button"
                            onClick={() => setExpanded(null)}
                            className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveAdmission(a._id)}
                            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold shadow-md hover:bg-slate-900 transition-colors"
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => complete(a._id)}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm Payment & Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded(a._id);
                          setForm({
                            services: a.services && a.services.length > 0
                              ? a.services.map(s => ({ description: s.description, amount: String(s.amountPaisa / 100) }))
                              : [{ description: '', amount: '' }],
                            billTotalPaisa: a.billTotalPaisa ? String(a.billTotalPaisa / 100) : '0',
                            paymentMethod: 'manual',
                            patientBillFileUrl: a.patientBillFileUrl || '',
                          });
                        }}
                        className="mt-3 px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl text-sm hover:bg-blue-100 transition-colors w-fit flex items-center gap-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Process Payment
                      </button>
                    )}
                  </>
                )}

                {a.billTotalPaisa > 0 && (
                  <p className="text-sm text-slate-600">
                    Bill: <span className="font-bold text-slate-900">{formatPkr(a.billTotalPaisa)}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Start Admission Form Dialog */}
      {admittingReferral && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Admit Patient</h3>
            <p className="text-xs text-slate-500 mb-5">
              Specify Room/Bed details to start admission for <span className="font-bold text-slate-800">{admittingReferral.patientName}</span> ({admittingReferral.referralCode}).
            </p>
            
            <form onSubmit={handleStartAdmission} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Room Number <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                  placeholder="e.g. Room 302"
                  value={admitForm.roomNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, roomNumber: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Bed Number <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                  placeholder="e.g. Bed 4"
                  value={admitForm.bedNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Admitted Department <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                  value={admitForm.admissionDepartment}
                  onChange={(e) => setAdmitForm({ ...admitForm, admissionDepartment: e.target.value })}
                >
                  <option value="">-- Choose Department --</option>
                  {hospitalInfo?.departments?.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  {admittingReferral.department && !hospitalInfo?.departments?.includes(admittingReferral.department) && (
                    <option value={admittingReferral.department}>{admittingReferral.department}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Treating Consultant / Doctor <span className="text-red-500">*</span></label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                  value={admitForm.treatingDoctorId}
                  onChange={(e) => setAdmitForm({ ...admitForm, treatingDoctorId: e.target.value })}
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctorsList?.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.name.replace(/^Dr\.\s*/i, '')} ({doc.specialty})
                    </option>
                  ))}
                </select>
                {doctorsList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No doctors on file. Add doctors under <strong>Manage doctors</strong> in the sidebar.
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdmittingReferral(null)}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Confirm & Admit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAdmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update bed placement</h3>
            <p className="text-xs text-slate-500 mb-5">
              {editingAdmission.referralId?.patientName} · {editingAdmission.referralId?.referralCode}
            </p>
            <form onSubmit={saveAdmissionPlacement} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Room Number *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  value={editAdmissionForm.roomNumber}
                  onChange={(e) => setEditAdmissionForm({ ...editAdmissionForm, roomNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Bed Number *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
                  value={editAdmissionForm.bedNumber}
                  onChange={(e) => setEditAdmissionForm({ ...editAdmissionForm, bedNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Department *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  value={editAdmissionForm.admissionDepartment}
                  onChange={(e) => setEditAdmissionForm({ ...editAdmissionForm, admissionDepartment: e.target.value })}
                >
                  {(hospitalInfo?.departments || []).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Treating doctor *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  value={editAdmissionForm.treatingDoctorId}
                  onChange={(e) => setEditAdmissionForm({ ...editAdmissionForm, treatingDoctorId: e.target.value })}
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctorsList.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.name.replace(/^Dr\.\s*/i, '')} ({doc.specialty})
                    </option>
                  ))}
                </select>
                {doctorsList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No doctors on file. Add them under Manage doctors.</p>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEditingAdmission(null)} className="px-4 py-2 text-sm font-bold text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalAdmissions;
