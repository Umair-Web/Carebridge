import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  Building2, Users, Inbox, Wallet, Activity, ArrowRight,
  RefreshCw, ShieldAlert, Cpu, HeartPulse, Clock, Stethoscope
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import Loader from '../../components/Loader';

const AdminOverview = () => {
  const [data, setData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [bedsData, setBedsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const loadAllDashboardData = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [analyticsRes, auditRes, bedsRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/audit-logs'),
        api.get('/admin/beds')
      ]);

      if (analyticsRes.data.success) {
        setData(analyticsRes.data.data);
      }
      if (auditRes.data.success) {
        // Take the latest 6 audit logs for preview
        setAuditLogs(auditRes.data.data.slice(0, 6));
      }
      if (bedsRes.data.success) {
        setBedsData(bedsRes.data.data);
      }
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      setErr(e.response?.data?.message || 'Failed to sync platform metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAllDashboardData();
    // Auto-refresh dashboard metrics every 45 seconds for a "live feed" feel
    const interval = setInterval(loadAllDashboardData, 45000);
    return () => clearInterval(interval);
  }, [loadAllDashboardData]);

  if (err) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 p-5 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-bold">Sync Interrupted</h3>
            <p className="text-sm text-red-600 mt-1">{err}</p>
          </div>
          <button 
            onClick={loadAllDashboardData}
            className="ml-auto px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors text-sm"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return <Loader message="Syncing real-time system metrics..." />;
  }

  // Aggregate Bed Inventory across all hospitals.
  // bedsInventory is an array of { ward, totalBeds, occupiedBeds, availableBeds }.
  const WARD_MAP = {
    icu: 'ICU', nicu: 'NICU', picu: 'PICU', hdu: 'HDU', general: 'General', private: 'Private',
  };
  const aggregateBeds = {
    icu: { total: 0, occupied: 0 },
    nicu: { total: 0, occupied: 0 },
    picu: { total: 0, occupied: 0 },
    hdu: { total: 0, occupied: 0 },
    general: { total: 0, occupied: 0 },
    private: { total: 0, occupied: 0 },
  };

  bedsData.forEach(h => {
    (h.bedsInventory || []).forEach(b => {
      const key = Object.keys(WARD_MAP).find(
        k => WARD_MAP[k].toLowerCase() === (b.ward || '').toLowerCase()
      );
      if (key) {
        aggregateBeds[key].total += Number(b.totalBeds || 0);
        aggregateBeds[key].occupied += Number(b.occupiedBeds || 0);
      }
    });
  });

  const chartData = (data?.topHospitals || []).map((h) => ({
    name: h.name?.length > 14 ? `${h.name.slice(0, 12)}…` : h.name,
    referrals: h.referrals,
  }));

  const cards = [
    { label: 'Total users', value: (data?.totalConsultants || 0) + (data?.totalHospitals || 0), icon: Users, color: 'from-blue-500 to-indigo-600', desc: 'Registered consultants & hospitals' },
    { label: 'Consultants', value: data?.totalConsultants || 0, icon: Stethoscope, color: 'from-teal-500 to-cyan-600', href: '/admin/consultants', desc: 'Accredited referring doctors' },
    { label: 'Hospitals', value: data?.totalHospitals || 0, icon: Building2, color: 'from-emerald-500 to-teal-600', href: '/admin/hospitals', desc: 'Partner facility networks' },
    { label: 'Pending approvals', value: data?.pendingApprovals || 0, icon: Inbox, color: 'from-amber-500 to-orange-600', href: '/admin/approvals', desc: 'Awaiting credential review', urgent: (data?.pendingApprovals > 0) },
    { label: 'Total referrals', value: data?.totalReferrals || 0, icon: Activity, color: 'from-violet-500 to-fuchsia-600', href: '/admin/referrals', desc: 'Lifetime referrals created' },
  ];

  const getActionBadgeStyle = (action) => {
    if (action.includes('OVERRIDE') || action.includes('REJECT')) return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60';
    if (action.includes('DISBURSE') || action.includes('APPROVE') || action.includes('ACCEPT')) return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60';
    return 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  };

  const getBedProgressColor = (percent) => {
    if (percent >= 85) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Real-time Status Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Super Admin Dashboard</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Real-time clinical insights, capacity monitoring, and system metrics.</p>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto justify-between bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Synced</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button 
            onClick={loadAllDashboardData}
            disabled={loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50"
            title="Refresh Live Metrics"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, href, desc, urgent }) => {
          const cardContent = (
            <div className="relative h-full flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} text-white shadow-md shadow-slate-900/10`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {urgent && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">{label}</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 mt-1.5 tabular-nums tracking-tight">{value}</p>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 border-t border-slate-50 dark:border-slate-800/40 pt-2">{desc}</p>
              {href && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all translate-x-1 -translate-y-1">
                  <div className="p-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <ArrowRight size={12} className="text-blue-500" />
                  </div>
                </div>
              )}
            </div>
          );

          return href ? (
            <Link key={label} to={href}
              className="group relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 block">
              {cardContent}
            </Link>
          ) : (
            <div key={label} className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm">
              {cardContent}
            </div>
          );
        })}
      </div>

      {/* Primary Analytics & Revenue Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue KPI block */}
        <div className="lg:col-span-1 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-950 p-6 shadow-xl text-white relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Wallet className="w-32 h-32" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Platform Economy</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 tracking-tight tabular-nums">
              {formatPkr(data?.platformRevenuePaisa || 0)}
            </h2>
            <p className="text-xs text-indigo-200/80 mt-1">Total revenue collected from finalized admissions.</p>
          </div>
          <div className="border-t border-indigo-800/50 pt-4 flex justify-between items-center text-xs">
            <span className="text-indigo-300 font-semibold">Closed Cases Disbursed</span>
            <span className="font-mono bg-indigo-800/40 px-2 py-1 rounded font-bold text-white">
              {data?.completedAdmissions || 0} admissions
            </span>
          </div>
        </div>

        {/* Top Hospitals Analytics block */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Top Referral Destination Partners
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Referral volumes routed per institution.</p>
          </div>

          <div className="mt-6">
            {chartData.length === 0 ? (
              <div className="h-44 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
                No referral activity logged yet.
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#0f172a', color: '#fff' }}
                      labelStyle={{ fontWeight: 800, color: '#3b82f6' }}
                    />
                    <Bar dataKey="referrals" radius={[6, 6, 0, 0]} name="Referrals Received">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Aggregate Bed Inventory Layer */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-red-500 animate-pulse" />
              Live System-Wide Care Capacities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Aggregated critical and emergency bed status across all hospitals.</p>
          </div>
          <Link to="/admin/beds" className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
            Manage Hospital Beds &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          {Object.keys(aggregateBeds).map((type) => {
            const { total, occupied } = aggregateBeds[type];
            const available = total - occupied;
            const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
            return (
              <div key={type} className="bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{type}</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">{occupied}</span>
                    <span className="text-xs text-slate-400">/ {total} Occupied</span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getBedProgressColor(percent)}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className={percent >= 85 ? 'text-red-500 animate-pulse' : 'text-slate-500'}>
                      {percent}% Full
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">{available} Free</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live System Activity and Compliance Audit */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Live Platform Activity Log Feed
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Live tracking of administrative actions and overrides.</p>
          </div>
          <Link to="/admin/audit" className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
            View All Logs &rarr;
          </Link>
        </div>

        <div className="mt-6 divide-y divide-slate-100 dark:divide-slate-800/80">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No recent logs found.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log._id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-950/40 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded border ${getActionBadgeStyle(log.action)}`}>
                    {log.action?.replace('ADMIN_', '').replace('_', ' ')}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      {log.adminId?.name || 'System Auto-Engine'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                      {log.entityModel} · IP: {log.ipAddress || 'System'}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium tabular-nums ml-10 sm:ml-0">
                  <Clock size={12} />
                  {new Date(log.createdAt).toLocaleString('en-PK', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default AdminOverview;
