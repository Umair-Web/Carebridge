import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from 'react-hot-toast';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import ConsultantRegister from './pages/ConsultantRegister';
import HospitalRegister from './pages/HospitalRegister';
import LaboratoryRegister from './pages/LaboratoryRegister';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ConsultantDashboard from './pages/ConsultantDashboard';
import SmartIntakeForm from './pages/SmartIntakeForm';
import ReferralsList from './pages/ReferralsList';
import HospitalDashboard from './pages/HospitalDashboard';
import ReferralInbox from './pages/ReferralInbox';
import HospitalReferrals from './pages/HospitalReferrals';
import BedManagement from './pages/BedManagement';
import HospitalAdmissions from './pages/HospitalAdmissions';
import DoctorManagement from './pages/DoctorManagement';
import HospitalEmergencyCenter from './pages/HospitalEmergencyCenter';
import HospitalDepartments from './pages/HospitalDepartments';
import ConsultantEarnings from './pages/ConsultantEarnings';
import HospitalLedger from './pages/HospitalLedger';
import HospitalSettlements from './pages/HospitalSettlements';
import AdminOverview from './pages/admin/AdminOverview';
import AdminApprovals from './pages/admin/AdminApprovals';
import AdminConsultants from './pages/admin/AdminConsultants';
import AdminHospitals from './pages/admin/AdminHospitals';
import AdminSettlements from './pages/admin/AdminSettlements';
import AdminScoring from './pages/admin/AdminScoring';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminSettings from './pages/admin/AdminSettings';
import AdminReferrals from './pages/admin/AdminReferrals';
import AdminBeds from './pages/admin/AdminBeds';
import AdminAudit from './pages/admin/AdminAudit';
import AdminLaboratory from './pages/admin/AdminLaboratory';
import ConsultantLaboratory from './pages/ConsultantLaboratory';
import LabDashboard from './pages/lab/LabDashboard';
import LabInbox from './pages/lab/LabInbox';
import LabReferrals from './pages/lab/LabReferrals';
import LabSettlements from './pages/lab/LabSettlements';
import LabTestCatalog from './pages/lab/LabTestCatalog';
import HospitalTeam from './pages/HospitalTeam';
import LabTeam from './pages/lab/LabTeam';
import AdminTeam from './pages/admin/AdminTeam';
const RoleGuard = ({ children, roles }) => {
  const { user, token } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (user && roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

/**
 * Global real-time listener. Uses the single shared socket and refreshes every
 * active TanStack query whenever a domain event or notification arrives, so all
 * dashboards (every role) stay live without a page refresh.
 */
const REALTIME_EVENTS = [
  'notification',
  'NEW_REFERRAL',
  'STATUS_UPDATE',
  'REFERRAL_ESCALATED',
  'BED_UPDATE',
  'NEW_CLINICAL_NOTE',
  'NEW_LAB_REFERRAL',
  'LAB_STATUS_UPDATE',
  'LAB_REPORT_UPLOADED',
];

const SocketListener = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return undefined;

    // Collapse bursts of events into a single refetch and only refresh the
    // queries currently on screen — avoids hammering the backend.
    let timer = null;
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ refetchType: 'active' });
      }, 500);
    };

    REALTIME_EVENTS.forEach((evt) => socket.on(evt, scheduleRefresh));

    return () => {
      if (timer) clearTimeout(timer);
      REALTIME_EVENTS.forEach((evt) => socket.off(evt, scheduleRefresh));
    };
  }, [socket, queryClient]);

  return null;
};

import ProfileSettings from './pages/ProfileSettings';

function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
      <SocketProvider>
      <NotificationProvider>
      <SocketListener />
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/consultant" element={<ConsultantRegister />} />
            <Route path="/register/hospital" element={<HospitalRegister />} />
            <Route path="/register/laboratory" element={<LaboratoryRegister />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          <Route element={<DashboardLayout />}>
            <Route path="/profile" element={<ProfileSettings />} />
            <Route path="/dashboard" element={<RoleGuard roles={['consultant']}><ConsultantDashboard /></RoleGuard>} />
            <Route path="/referrals/new" element={<RoleGuard roles={['consultant']}><SmartIntakeForm /></RoleGuard>} />
            <Route path="/referrals" element={<RoleGuard roles={['consultant']}><ReferralsList /></RoleGuard>} />
            <Route path="/earnings" element={<RoleGuard roles={['consultant']}><ConsultantEarnings /></RoleGuard>} />
            <Route path="/lab-referrals" element={<RoleGuard roles={['consultant']}><ConsultantLaboratory /></RoleGuard>} />

            <Route path="/hospital/dashboard" element={<RoleGuard roles={['hospital']}><HospitalDashboard /></RoleGuard>} />
            <Route path="/hospital/inbox" element={<RoleGuard roles={['hospital']}><ReferralInbox /></RoleGuard>} />
            <Route path="/hospital/referrals" element={<RoleGuard roles={['hospital']}><HospitalReferrals /></RoleGuard>} />
            <Route path="/hospital/admissions" element={<RoleGuard roles={['hospital']}><HospitalAdmissions /></RoleGuard>} />
            <Route path="/hospital/beds" element={<RoleGuard roles={['hospital']}><BedManagement /></RoleGuard>} />
            <Route path="/hospital/doctors" element={<RoleGuard roles={['hospital']}><DoctorManagement /></RoleGuard>} />
            <Route path="/hospital/emergency" element={<RoleGuard roles={['hospital']}><HospitalEmergencyCenter /></RoleGuard>} />
            <Route path="/hospital/departments" element={<RoleGuard roles={['hospital']}><HospitalDepartments /></RoleGuard>} />
            <Route path="/hospital/ledger" element={<RoleGuard roles={['hospital']}><HospitalLedger /></RoleGuard>} />
            <Route path="/hospital/settlements" element={<RoleGuard roles={['hospital']}><HospitalSettlements /></RoleGuard>} />
            <Route path="/hospital/team" element={<RoleGuard roles={['hospital']}><HospitalTeam /></RoleGuard>} />

            <Route path="/lab/dashboard" element={<RoleGuard roles={['laboratory']}><LabDashboard /></RoleGuard>} />
            <Route path="/lab/inbox" element={<RoleGuard roles={['laboratory']}><LabInbox /></RoleGuard>} />
            <Route path="/lab/referrals" element={<RoleGuard roles={['laboratory']}><LabReferrals /></RoleGuard>} />
            <Route path="/lab/settlements" element={<RoleGuard roles={['laboratory']}><LabSettlements /></RoleGuard>} />
            <Route path="/lab/tests" element={<RoleGuard roles={['laboratory']}><LabTestCatalog /></RoleGuard>} />
            <Route path="/lab/team" element={<RoleGuard roles={['laboratory']}><LabTeam /></RoleGuard>} />

            <Route path="/admin/overview" element={<RoleGuard roles={['admin']}><AdminOverview /></RoleGuard>} />
            <Route path="/admin/approvals" element={<RoleGuard roles={['admin']}><AdminApprovals /></RoleGuard>} />
            <Route path="/admin/consultants" element={<RoleGuard roles={['admin']}><AdminConsultants /></RoleGuard>} />
            <Route path="/admin/hospitals" element={<RoleGuard roles={['admin']}><AdminHospitals /></RoleGuard>} />
            <Route path="/admin/scoring" element={<RoleGuard roles={['admin']}><AdminScoring /></RoleGuard>} />
            <Route path="/admin/departments" element={<RoleGuard roles={['admin']}><AdminDepartments /></RoleGuard>} />
            <Route path="/admin/payouts" element={<RoleGuard roles={['admin']}><AdminPayouts /></RoleGuard>} />
            <Route path="/admin/settlements" element={<RoleGuard roles={['admin']}><AdminSettlements /></RoleGuard>} />
            <Route path="/admin/settings" element={<RoleGuard roles={['admin']}><AdminSettings /></RoleGuard>} />
            <Route path="/admin/referrals" element={<RoleGuard roles={['admin']}><AdminReferrals /></RoleGuard>} />
            <Route path="/admin/beds" element={<RoleGuard roles={['admin']}><AdminBeds /></RoleGuard>} />
            <Route path="/admin/audit" element={<RoleGuard roles={['admin']}><AdminAudit /></RoleGuard>} />
            <Route path="/admin/laboratory" element={<RoleGuard roles={['admin']}><AdminLaboratory /></RoleGuard>} />
            <Route path="/admin/admins" element={<RoleGuard roles={['admin']}><AdminTeam /></RoleGuard>} />
            <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
          </Route>
        </Routes>
      </Router>
      </NotificationProvider>
      </SocketProvider>
      </BrandingProvider>
    </AuthProvider>
  );
}

export default App;
