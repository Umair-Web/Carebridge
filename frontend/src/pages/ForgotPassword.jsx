import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email address is required');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) {
        toast.success(res.data.message || 'Reset link sent successfully!');
        setIsSubmitted(true);
      } else {
        toast.error(res.data.message || 'Failed to process request');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process forgot password request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl transition-all">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl mb-4">
            🔑
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Forgot password?</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No worries! Enter your registered email below, and we'll send you a secure link to reset your password.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-400 text-sm">
              <p className="font-semibold mb-1">Check your inbox!</p>
              <p>We've sent a secure password reset link to <strong>{email}</strong>. Please check your junk or spam folders if you don't receive it shortly.</p>
            </div>
            <div>
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 placeholder-slate-400 text-slate-900 dark:text-white bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all shadow-sm"
                placeholder="doctor@carebridge.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 shadow-md hover:shadow-lg"
              >
                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
              </button>
            </div>

            <div className="text-center text-sm mt-6">
              <span className="text-slate-600 dark:text-slate-400">Remembered your password? </span>
              <Link to="/login" className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
