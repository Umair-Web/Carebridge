import { useState, useEffect } from 'react';
import { Navigate, Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthContext';
import { useBranding } from '../context/BrandingContext';
import BrandLogo from '../components/BrandLogo';
import BrandNavLink from '../components/BrandNavLink';
import NotificationBell from '../components/NotificationBell';
import { Sun, Moon } from 'lucide-react';
import api from '../utils/api';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { effective } = useBranding();
  const brandPrimary = effective.primaryColor || '#2563eb';
  const navigate = useNavigate();
  const location = useLocation();

  const mobileNavClass = (isActive) =>
    `whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${
      isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300'
    }`;
  const mobileNavStyle = (isActive) => (isActive ? { backgroundColor: brandPrimary } : undefined);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Sidebar badge counters. Kept fresh in real time by the global socket
  // listener (invalidates these queries on events); the slow interval is just
  // a safety-net fallback so we don't poll the backend aggressively.
  const { data: inboxData } = useQuery({
    queryKey: ['hospital-inbox-count'],
    queryFn: async () => {
      const res = await api.get('/referrals/inbox');
      return res.data.data || [];
    },
    enabled: !!user && user.role === 'hospital',
    refetchInterval: 120000,
  });

  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      const res = await api.get('/admin/users/pending');
      return res.data.data || [];
    },
    enabled: !!user && user.role === 'admin',
    refetchInterval: 120000,
  });

  const inboxCount = inboxData?.length || 0;
  const approvalsCount = pendingApprovalsData?.length || 0;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors">
      {/* Mobile top nav */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between dark:bg-slate-900 dark:border-slate-800 transition-colors">
        <BrandLogo size="sm" className="text-base" />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-semibold text-red-600 dark:text-red-400"
          >
            Out
          </button>
        </div>
      </header>
      
      {/* Mobile bottom scroll nav */}
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 bg-white border-b border-slate-100 scrollbar-hide dark:bg-slate-900 dark:border-slate-800">
        {user.role === 'consultant' && (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Home</NavLink>
            <NavLink to="/referrals/new" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>New</NavLink>
            <NavLink to="/referrals" className={({ isActive }) => mobileNavClass(isActive || location.pathname === '/referrals/new')} style={({ isActive }) => mobileNavStyle(isActive || location.pathname === '/referrals/new')}>List</NavLink>
            <NavLink to="/earnings" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Earn</NavLink>
            <NavLink to="/lab-referrals" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Lab</NavLink>
            <NavLink to="/profile" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Profile</NavLink>
          </>
        )}
        {user.role === 'hospital' && (
          <>
            <NavLink to="/hospital/dashboard" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Home</NavLink>
            <NavLink to="/hospital/emergency" className={({ isActive }) => `whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${isActive ? 'bg-red-600 text-white shadow-sm' : 'text-red-500 hover:bg-red-50'}`}>Emergency</NavLink>
            <NavLink to="/hospital/inbox" className={({ isActive }) => `${mobileNavClass(isActive)} flex items-center gap-1.5`} style={({ isActive }) => mobileNavStyle(isActive)}>
              Inbox
              {inboxCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded-full animate-pulse">
                  {inboxCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/hospital/referrals" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Referrals</NavLink>
            <NavLink to="/hospital/admissions" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Admit</NavLink>
            <NavLink to="/hospital/ledger" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Ledger</NavLink>
            <NavLink to="/hospital/settlements" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Settlements</NavLink>
            <NavLink to="/hospital/beds" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Beds</NavLink>
            <NavLink to="/hospital/departments" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Depts</NavLink>
            <NavLink to="/hospital/doctors" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Docs</NavLink>
            <NavLink to="/hospital/team" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Team</NavLink>
            <NavLink to="/profile" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Profile</NavLink>
          </>
        )}
        {user.role === 'admin' && (
          <>
            <NavLink to="/admin/overview" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Overview</NavLink>
            <NavLink to="/admin/referrals" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Referrals</NavLink>
            <NavLink to="/admin/beds" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Beds</NavLink>
            <NavLink to="/admin/approvals" className={({ isActive }) => `${mobileNavClass(isActive)} flex items-center gap-1.5`} style={({ isActive }) => mobileNavStyle(isActive)}>
              Approvals
              {approvalsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-white rounded-full">
                  {approvalsCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/admin/consultants" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Consultants</NavLink>
            <NavLink to="/admin/hospitals" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Hospitals</NavLink>
            <NavLink to="/admin/payouts" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Payouts</NavLink>
            <NavLink to="/admin/settlements" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Settlements</NavLink>
            <NavLink to="/admin/settings" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Setup</NavLink>
            <NavLink to="/admin/audit" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Audit</NavLink>
            <NavLink to="/admin/laboratory" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Lab</NavLink>
            <NavLink to="/admin/admins" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Admins</NavLink>
            <NavLink to="/profile" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Profile</NavLink>
          </>
        )}
        {user.role === 'laboratory' && (
          <>
            <NavLink to="/lab/dashboard" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Home</NavLink>
            <NavLink to="/lab/inbox" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Inbox</NavLink>
            <NavLink to="/lab/referrals" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Referrals</NavLink>
            <NavLink to="/lab/settlements" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Settlements</NavLink>
            <NavLink to="/lab/tests" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Tests</NavLink>
            <NavLink to="/lab/team" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Team</NavLink>
            <NavLink to="/profile" className={({ isActive }) => mobileNavClass(isActive)} style={({ isActive }) => mobileNavStyle(isActive)}>Profile</NavLink>
          </>
        )}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col dark:bg-slate-900 dark:border-slate-800 transition-colors h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 transition-colors flex items-center justify-between gap-2">
          <BrandLogo size="md" className="text-xl" />
          <NotificationBell align="left" />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {user.role === 'consultant' && (
            <>
              <BrandNavLink to="/dashboard"><span>Dashboard</span></BrandNavLink>
              <BrandNavLink to="/referrals/new" end><span>New referral</span></BrandNavLink>
              <BrandNavLink to="/referrals" end><span>My referrals</span></BrandNavLink>
              <BrandNavLink to="/earnings"><span>Earnings</span></BrandNavLink>
              <BrandNavLink to="/lab-referrals"><span>Laboratory</span></BrandNavLink>
              <BrandNavLink to="/profile"><span>Profile settings</span></BrandNavLink>
            </>
          )}

          {user.role === 'hospital' && (
            <>
              <BrandNavLink to="/hospital/dashboard"><span>Dashboard</span></BrandNavLink>
              <NavLink to="/hospital/emergency" className={({ isActive }) => `flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'}`}>
                <span>Emergency Center</span>
              </NavLink>
              <BrandNavLink to="/hospital/inbox">
                <>
                  <span>Inbox</span>
                  {inboxCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-black leading-none bg-red-500 text-white rounded-full animate-pulse shadow-sm">
                      {inboxCount}
                    </span>
                  )}
                </>
              </BrandNavLink>
              <BrandNavLink to="/hospital/referrals"><span>All Referrals</span></BrandNavLink>
              <BrandNavLink to="/hospital/admissions"><span>Admissions & billing</span></BrandNavLink>
              <BrandNavLink to="/hospital/ledger"><span>Financial Ledger</span></BrandNavLink>
              <BrandNavLink to="/hospital/settlements"><span>Weekly Settlements</span></BrandNavLink>
              <BrandNavLink to="/hospital/beds"><span>Bed management</span></BrandNavLink>
              <BrandNavLink to="/hospital/departments"><span>Departments</span></BrandNavLink>
              <BrandNavLink to="/hospital/doctors"><span>Manage doctors</span></BrandNavLink>
              <BrandNavLink to="/hospital/team"><span>Team &amp; logins</span></BrandNavLink>
              <BrandNavLink to="/profile"><span>Profile settings</span></BrandNavLink>
            </>
          )}

          {user.role === 'admin' && (
            <>
              <BrandNavLink to="/admin/overview"><span>Overview</span></BrandNavLink>
              <BrandNavLink to="/admin/referrals"><span>Referrals</span></BrandNavLink>
              <BrandNavLink to="/admin/beds"><span>Bed Management</span></BrandNavLink>
              <BrandNavLink to="/admin/approvals">
                <>
                  <span>Approvals</span>
                  {approvalsCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-black leading-none bg-amber-500 text-white rounded-full shadow-sm">
                      {approvalsCount}
                    </span>
                  )}
                </>
              </BrandNavLink>
              <BrandNavLink to="/admin/consultants"><span>Consultants</span></BrandNavLink>
              <BrandNavLink to="/admin/hospitals"><span>Hospitals</span></BrandNavLink>
              <BrandNavLink to="/admin/payouts"><span>Payouts</span></BrandNavLink>
              <BrandNavLink to="/admin/settlements"><span>Settlements Queue</span></BrandNavLink>
              <BrandNavLink to="/admin/scoring"><span>Scoring weights</span></BrandNavLink>
              <BrandNavLink to="/admin/departments"><span>Departments</span></BrandNavLink>
              <BrandNavLink to="/admin/settings"><span>Settings</span></BrandNavLink>
              <BrandNavLink to="/admin/audit"><span>Audit Logs</span></BrandNavLink>
              <BrandNavLink to="/admin/laboratory"><span>Laboratory</span></BrandNavLink>
              <BrandNavLink to="/admin/admins"><span>Admin Team</span></BrandNavLink>
              <BrandNavLink to="/profile"><span>Profile settings</span></BrandNavLink>
            </>
          )}

          {user.role === 'laboratory' && (
            <>
              <BrandNavLink to="/lab/dashboard"><span>Dashboard</span></BrandNavLink>
              <BrandNavLink to="/lab/inbox"><span>Inbox</span></BrandNavLink>
              <BrandNavLink to="/lab/referrals"><span>Referrals & Billing</span></BrandNavLink>
              <BrandNavLink to="/lab/settlements"><span>Weekly Settlements</span></BrandNavLink>
              <BrandNavLink to="/lab/tests"><span>Test Catalog</span></BrandNavLink>
              <BrandNavLink to="/lab/team"><span>Team &amp; logins</span></BrandNavLink>
              <BrandNavLink to="/profile"><span>Profile settings</span></BrandNavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Appearance</span>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              {isDarkMode ? (
                <>
                  <Sun size={14} className="text-amber-500" /> Light
                </>
              ) : (
                <>
                  <Moon size={14} /> Dark
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: `${brandPrimary}22`, color: brandPrimary }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl text-sm font-semibold transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
