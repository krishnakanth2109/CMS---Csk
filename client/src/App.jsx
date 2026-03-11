import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Auth Pages
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Layout
import DashboardLayout from '@/components/DashboardLayout';

// Admin Pages
import AdminDashboard from '@/pages/AdminDashboard';
import AddCandidate from '@/pages/AddCandidate';
import AdminRecruiters from '@/pages/AdminRecruiters';
import AdminClientInfo from '@/pages/AdminClientInfo';
import AdminClientInvoice from '@/pages/AdminClientInvoice';
import AdminRequirements from '@/pages/AdminRequirements';
import AdminSchedules from '@/pages/AdminSchedules';
import AdminMessages from '@/pages/AdminMessages';
import AdminReports from '@/pages/AdminReports';
import AdminSettings from '@/pages/AdminSettings';

// ✅ NEW: Manager Messages page
import ManagerMessages from '@/pages/ManagerMessages';

// Recruiter Pages
import RecruiterDashboard from '@/pages/RecruiterDashboard';
import RecruiterCandidates from '@/pages/RecruiterCandidates';
import RecruiterAssignments from '@/pages/RecruiterAssignments';
import RecruiterSchedules from '@/pages/RecruiterSchedules';
import MessagesRecruiters from '@/pages/MessagesRecruiters';
import RecruiterReports from '@/pages/RecruiterReports';
import RecruiterProfile from '@/pages/RecruiterProfile';
import RecruiterSettings from '@/pages/RecruiterSettings';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, userRole, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    const destination = (userRole === 'admin' || userRole === 'manager') ? '/admin' : '/recruiter';
    return <Navigate to={destination} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, userRole, loading } = useAuth();
  if (loading) return null;
  
  if (isAuthenticated) {
    const destination = (userRole === 'admin' || userRole === 'manager') ? '/admin' : '/recruiter';
    return <Navigate to={destination} replace />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ===================== ADMIN / MANAGER ROUTES ===================== */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="add-candidate" element={<AddCandidate />} />
        <Route path="my-candidates" element={<RecruiterCandidates />} />
        <Route path="recruiters" element={<AdminRecruiters />} />
        <Route path="clients" element={<AdminClientInfo />} />
        <Route path="invoices" element={<AdminClientInvoice />} />
        <Route path="requirements" element={<AdminRequirements />} />
        <Route path="schedules" element={<AdminSchedules />} />

        {/* ✅ Admin sees AdminMessages, Manager sees ManagerMessages */}
        <Route path="messages" element={<AdminMessages />} />
        <Route path="manager-messages" element={<ManagerMessages />} />

        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* ===================== RECRUITER ROUTES ===================== */}
      <Route path="/recruiter" element={
        <ProtectedRoute allowedRoles={['recruiter', 'manager', 'admin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<RecruiterDashboard />} />
        <Route path="candidates" element={<RecruiterCandidates />} />
        <Route path="assignments" element={<RecruiterAssignments />} />
        <Route path="schedules" element={<RecruiterSchedules />} />
        <Route path="messages" element={<MessagesRecruiters />} />
        <Route path="reports" element={<RecruiterReports />} />
        <Route path="profile" element={<RecruiterProfile />} />
        <Route path="settings" element={<RecruiterSettings />} />
      </Route>

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
