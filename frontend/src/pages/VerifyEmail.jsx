import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Activity, Mail, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const OTP_LENGTH = 6;

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (idx, value) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = v;
    setDigits(next);
    if (v && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    [...pasted].forEach((ch, i) => (next[i] = ch));
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      toast.error('Please enter the full 6-digit code');
      return;
    }
    if (!email) {
      toast.error('Email address missing. Please register again.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await api.post('/auth/verify-email-otp', { email, otp });
      if (res.data.success) {
        setVerified(true);
        toast.success('Email verified!', { icon: '✅', duration: 5000 });
      } else {
        toast.error(res.data.message || 'Verification failed');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (!email) {
      toast.error('Email address missing. Please register again.');
      return;
    }
    setIsResending(true);
    try {
      const res = await api.post('/auth/resend-email-otp', { email });
      if (res.data.success) {
        toast.success('New code sent to your email!', { icon: '✉️' });
        setResendCooldown(60);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = (() => {
    if (!email) return 'your email';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const shown = local.slice(0, 2);
    return `${shown}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-blue-500 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/30">
          <Activity size={28} />
        </div>
        <span className="text-2xl font-bold tracking-tight text-white">
          CareBridge<span className="text-blue-400">Health</span>
        </span>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        {!verified ? (
          <>
            {/* Email icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-blue-500/20 border border-blue-500/30 p-5 rounded-2xl">
                <Mail size={40} className="text-blue-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
            <p className="text-slate-400 text-sm mb-1">
              We sent a 6-digit code to your email
            </p>
            <p className="text-blue-400 font-mono font-semibold text-sm mb-8">
              {maskedEmail}
            </p>

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  id={`otp-digit-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`
                    w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none
                    bg-white/10 text-white
                    ${d ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/20' : 'border-white/20 focus:border-blue-400'}
                  `}
                />
              ))}
            </div>

            {/* Verify button */}
            <button
              id="btn-verify-email"
              onClick={handleVerify}
              disabled={isVerifying || digits.join('').length < OTP_LENGTH}
              className="w-full py-3.5 px-6 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 mb-4"
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Email
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Resend */}
            <button
              id="btn-resend-otp"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mx-auto"
            >
              <RefreshCw size={14} className={isResending ? 'animate-spin' : ''} />
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : isResending
                ? 'Sending...'
                : "Didn't receive it? Resend"}
            </button>

            <p className="text-xs text-slate-500 mt-6">
              Check your spam folder if the code doesn't arrive within a minute.
            </p>
          </>
        ) : (
          /* Success state */
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-blue-500/20 border border-blue-500/30 p-5 rounded-2xl">
                <CheckCircle size={48} className="text-blue-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
            <p className="text-slate-400 text-sm">
              Your email address has been confirmed.
              <br /><br />
              Your account is now pending admin approval. You'll be able to log in once it's approved.
            </p>
            <Link
              to="/login"
              className="block w-full py-3.5 px-6 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 text-center"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-8">
        © {new Date().getFullYear()} CareBridge Health. All rights reserved.
      </p>
    </div>
  );
};

export default VerifyEmail;
