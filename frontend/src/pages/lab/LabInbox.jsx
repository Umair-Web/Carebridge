import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Clock, Check, X, User, Stethoscope, Percent } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';
import { ageLabel } from '../../utils/dob';

const urgencyTone = {
  emergency: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  urgent: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  routine: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const LabInbox = () => {
  const queryClient = useQueryClient();
  const [expectedAt, setExpectedAt] = useState({});
  const [busy, setBusy] = useState({});

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['lab-inbox'],
    queryFn: async () => (await api.get('/lab-referrals/inbox')).data.data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['lab-dashboard'] });
  };

  const accept = async (id) => {
    const when = expectedAt[id];
    if (!when) return toast.error('Set the expected report date & time first');
    try {
      setBusy((b) => ({ ...b, [id]: true }));
      await api.patch(`/lab-referrals/${id}/accept`, { expectedReportAt: new Date(when).toISOString() });
      toast.success('Referral accepted');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const reject = async (id) => {
    const reason = window.prompt('Reason for declining (optional):') || 'Declined by laboratory';
    try {
      setBusy((b) => ({ ...b, [id]: true }));
      await api.patch(`/lab-referrals/${id}/reject`, { rejectionReason: reason });
      toast.success('Referral declined');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decline');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  if (isLoading) return <Loader message="Loading inbox..." />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <Inbox className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Referral Inbox</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">New test referrals awaiting your response.</p>
        </div>
      </div>

      {referrals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          <Inbox className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-bold">No pending referrals.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {referrals.map((r) => (
            <div key={r._id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{r.referralCode}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${urgencyTone[r.urgency] || urgencyTone.routine}`}>
                  {r.urgency}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <User size={15} className="text-slate-400" />
                  <span className="font-semibold">{r.patientName}</span>
                  <span className="text-slate-400">• {ageLabel(r)} • {r.gender}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Stethoscope size={15} className="text-slate-400" />
                  <span>Dr. {r.consultantId?.userId?.name || 'Consultant'}</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Recommended Tests</p>
                <div className="flex flex-wrap gap-1.5">
                  {(r.recommendedTests || []).map((t, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-xs font-semibold">
                      {t.testName}
                    </span>
                  ))}
                </div>
              </div>

              {r.discountPercentage > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Percent size={13} /> Consultant discount for patient: {r.discountPercentage}%
                </div>
              )}

              {r.summaryNotes && <p className="text-xs text-slate-500 dark:text-slate-400">{r.summaryNotes}</p>}

              <div className="flex flex-col sm:flex-row sm:items-end gap-3 border-t border-slate-50 dark:border-slate-800 pt-4">
                <div className="flex-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
                    <Clock size={13} /> Expected report date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={expectedAt[r._id] || ''}
                    onChange={(e) => setExpectedAt((s) => ({ ...s, [r._id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => accept(r._id)}
                    disabled={busy[r._id]}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-60"
                  >
                    <Check size={16} /> Accept
                  </button>
                  <button
                    onClick={() => reject(r._id)}
                    disabled={busy[r._id]}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-sm rounded-lg transition-colors disabled:opacity-60"
                  >
                    <X size={16} /> Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LabInbox;
