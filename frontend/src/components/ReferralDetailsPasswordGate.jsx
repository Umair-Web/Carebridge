import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

/**
 * Modal to unlock referral/patient details with the per-referral password.
 * Default password is 123456 (set at referral creation).
 */
const ReferralDetailsPasswordGate = ({
  referral,
  onClose,
  onUnlocked,
  verifyPath,
  allowForgotPassword = false,
  forgotPath,
}) => {
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [sendingForgot, setSendingForgot] = useState(false);

  if (!referral) return null;

  const label = referral.referralCode
    ? `${referral.patientName || 'Patient'} (${referral.referralCode})`
    : referral.patientName || 'this referral';

  const path =
    verifyPath ||
    `/referrals/${referral._id}/verify-details-password`;

  const forgotEndpoint =
    forgotPath ||
    `/admin/referrals/${referral._id}/forgot-details-password`;

  const submit = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Enter the referral access password');
      return;
    }
    setUnlocking(true);
    try {
      const res = await api.post(path, { password });
      if (res.data.success && res.data.unlockToken) {
        toast.success('Access granted');
        onUnlocked(res.data.unlockToken, res.data.detailsViewAccess);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setUnlocking(false);
    }
  };

  const handleForgot = async () => {
    setSendingForgot(true);
    try {
      const res = await api.post(forgotEndpoint);
      toast.success(res.data.message || 'Reset link sent to infocarebridgesystem@gmail.com');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setSendingForgot(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Password required</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Enter the referral access password for{' '}
                <span className="font-semibold text-slate-700">{label}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Referral access password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter access password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={unlocking}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {unlocking ? 'Verifying…' : 'Unlock details'}
            </button>
          </div>
          {allowForgotPassword && (
            <div className="text-center pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={handleForgot}
                disabled={sendingForgot}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {sendingForgot ? 'Sending email…' : 'Forgot password?'}
              </button>
              <p className="text-[11px] text-slate-400 mt-1">
                We’ll email a reset link to infocarebridgesystem@gmail.com.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ReferralDetailsPasswordGate;
