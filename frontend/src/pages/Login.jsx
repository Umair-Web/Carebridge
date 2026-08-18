import { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'hospital') navigate('/hospital/dashboard');
      else if (user.role === 'admin') navigate('/admin/overview');
      else if (user.role === 'laboratory') navigate('/lab/dashboard');
      else navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
      if (result.user.role === 'hospital') {
        navigate('/hospital/dashboard');
      } else if (result.user.role === 'admin') {
        navigate('/admin/overview');
      } else if (result.user.role === 'laboratory') {
        navigate('/lab/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      if (result.needsEmailVerification) {
        toast.error('Please verify your email address. Check your inbox!', { duration: 6000, icon: '✉️' });
        setShowResendEmail(true);
      } else {
        toast.error(result.message || 'Login failed');
      }
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }
    setIsResendingEmail(true);
    try {
      const res = await api.post('/auth/resend-email-otp', { email });
      if (res.data.success) {
        toast.success(res.data.message, { icon: '✉️' });
        navigate('/verify-email', { state: { email } });
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend verification code');
    } finally {
      setIsResendingEmail(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sign in to your account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your credentials to access your dashboard.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              required
              className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all shadow-sm"
              placeholder="doctor@carebridge.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all shadow-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded" />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
              Remember me
            </label>
          </div>
          <div className="text-sm">
            <Link to="/forgot-password" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
              Forgot your password?
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 shadow-md hover:shadow-lg"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
        
        {showResendEmail && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3 mt-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-800 font-semibold">Email not verified</p>
              <p className="text-xs text-blue-600 mt-0.5">Enter the 6-digit code we email you to verify your account.</p>
              <button
                type="button"
                disabled={isResendingEmail}
                onClick={handleResendEmail}
                className="mt-2 text-sm font-bold text-blue-700 hover:text-blue-900 transition-colors"
              >
                {isResendingEmail ? 'Sending…' : '✉️ Send verification code'}
              </button>
            </div>
          </div>
        )}
        
        <div className="text-center text-sm mt-6">
          <span className="text-slate-600">Don't have an account? </span>
          <Link to="/register" className="font-bold text-blue-600 hover:text-blue-500 transition-colors">
            Register now
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
