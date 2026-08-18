import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FlaskConical, Inbox, FileCheck2, CheckCircle2, Banknote, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import Loader from '../../components/Loader';

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${tone}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 dark:text-slate-50 tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  </div>
);

const LabDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['lab-dashboard'],
    queryFn: async () => (await api.get('/labs/dashboard')).data.data,
  });

  if (isLoading) return <Loader message="Loading laboratory dashboard..." />;

  const c = data?.counts || {};

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Laboratory Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage incoming test referrals, upload reports, and bill cases.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Inbox} label="Pending" value={c.pending || 0} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" />
        <StatCard icon={FlaskConical} label="In Progress" value={c.accepted || 0} tone="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" />
        <StatCard icon={FileCheck2} label="Reported" value={c.reported || 0} tone="bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" />
        <StatCard icon={CheckCircle2} label="Closed" value={c.closed || 0} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Banknote className="w-7 h-7 text-sky-400" />
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Platform Fee Owed (unsettled)</p>
            <p className="text-2xl font-black text-sky-400 tabular-nums">{formatPkr(data?.platformCutOwedPaisa || 0)}</p>
          </div>
        </div>
        <Link
          to="/lab/settlements"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 rounded-xl font-bold text-sm transition-colors"
        >
          Go to Settlements <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/lab/inbox" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 hover:border-sky-400 transition-colors">
          <Inbox className="w-6 h-6 text-sky-600 mb-2" />
          <p className="font-bold text-slate-900 dark:text-slate-100">Inbox</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Accept or decline new referrals</p>
        </Link>
        <Link to="/lab/referrals" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 hover:border-sky-400 transition-colors">
          <FileCheck2 className="w-6 h-6 text-sky-600 mb-2" />
          <p className="font-bold text-slate-900 dark:text-slate-100">Referrals & Billing</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Upload reports and finalize bills</p>
        </Link>
        <Link to="/lab/tests" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 hover:border-sky-400 transition-colors">
          <FlaskConical className="w-6 h-6 text-sky-600 mb-2" />
          <p className="font-bold text-slate-900 dark:text-slate-100">Test Catalog</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage offered tests and prices</p>
        </Link>
      </div>
    </div>
  );
};

export default LabDashboard;
