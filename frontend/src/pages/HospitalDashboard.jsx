import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Inbox, BedDouble, ClipboardList, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Loader from '../components/Loader';
import { formatPkr } from '../utils/formatPkr';

const HospitalDashboard = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([api.get('/hospitals/dashboard'), api.get('/hospitals/analytics')]);
      if (d.data.success) setStats(d.data.data);
      if (a.data.success) setAnalytics(a.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader message="Loading dashboard..." />;
  if (!stats) {
    return <div className="text-center text-red-600 py-12">Could not load dashboard.</div>;
  }

  const chartData = analytics?.referralsByDay || [];

  const kpis = [
    { label: 'Total referrals', value: stats.totalReferrals, accent: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending inbox', value: stats.pendingReferrals, accent: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Admitted', value: stats.admittedReferrals ?? 0, accent: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Billed revenue', value: formatPkr(stats.revenuePaisa || 0), accent: 'text-emerald-600', bg: 'bg-emerald-50', isText: true },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Hospital dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Live KPIs and bed snapshot (FR-20).</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-white border border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-xs sm:text-sm font-medium text-slate-500">{k.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-2 tabular-nums ${k.accent}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {analytics && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-900">Referral volume (14 days)</h2>
            </div>
            <div className="h-56 w-full">
              {chartData.length === 0 ? (
                <p className="text-slate-500 text-sm py-12 text-center">Not enough data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillRef" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                    <Area type="monotone" dataKey="count" stroke="#2563eb" fill="url(#fillRef)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 sm:p-6 shadow-lg">
            <p className="text-slate-400 text-sm font-medium">Conversion (closed / decided)</p>
            <p className="text-4xl font-bold mt-2">{analytics.conversionRate ?? 0}%</p>
            <p className="text-xs text-slate-400 mt-4">This month billed: {formatPkr(analytics.monthlyBillPaisa || 0)}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Bed availability</h2>
          <div className="space-y-3">
            {stats.beds.map((ward) => (
              <div key={ward.ward} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-900">{ward.ward}</p>
                  <p className="text-xs text-slate-500">{ward.totalBeds} total</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${ward.availableBeds > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {ward.availableBeds} free
                  </p>
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden ml-auto">
                    <div
                      className={`h-full ${ward.availableBeds > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${ward.totalBeds ? (ward.availableBeds / ward.totalBeds) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/hospital/inbox"
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100 transition-colors border border-blue-100"
            >
              <Inbox className="w-5 h-5 shrink-0" />
              Inbox
            </Link>
            <Link
              to="/hospital/admissions"
              className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 text-indigo-800 font-semibold hover:bg-indigo-100 transition-colors border border-indigo-100"
            >
              <ClipboardList className="w-5 h-5 shrink-0" />
              Admissions
            </Link>
            <Link
              to="/hospital/beds"
              className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100 transition-colors border border-amber-100"
            >
              <BedDouble className="w-5 h-5 shrink-0" />
              Beds
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalDashboard;
