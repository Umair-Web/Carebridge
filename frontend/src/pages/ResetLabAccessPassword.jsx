import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';

const ResetLabAccessPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Invalid reset URL. Missing token.');
      return;
    }
    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/reset-lab-access-password', {
        token,
        newPassword: password,
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Lab access password updated');
        navigate('/admin/laboratory');
      } else {
        toast.error(res.data.message || 'Failed to reset password');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xl mb-4">
            🔑
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Reset lab access password
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Set a new password for unlocking laboratory profiles in the admin portal.
            This is not your admin login password.
          </p>
        </div>

        {!token ? (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-400 text-sm">
            <p className="font-semibold mb-1">Invalid link</p>
            <p>This reset link is invalid or incomplete. Request a new one from Laboratory → View details.</p>
            <div className="mt-4">
              <Link to="/admin/laboratory" className="font-bold text-blue-600 hover:text-blue-500">
                Back to Laboratories &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New access password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-700 placeholder-slate-400 text-slate-900 dark:text-white bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  className="appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-700 placeholder-slate-400 text-slate-900 dark:text-white bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:text-sm"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 text-sm font-bold rounded-xl text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-70"
            >
              {isLoading ? 'Updating…' : 'Set new access password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetLabAccessPassword;
