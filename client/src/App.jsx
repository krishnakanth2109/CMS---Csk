import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import React, { Suspense, lazy } from 'react';

// Auth Pages (Lazy)
const Login = lazy(() => import('@/pages/Login'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

// Layout
const DashboardLayout = lazy(() => import('@/components/DashboardLayout'));

// Admin Pages (Lazy)
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AddCandidate = lazy(() => import('@/pages/AddCandidate'));
const AdminRecruiters = lazy(() => import('@/pages/AdminRecruiters'));
const AdminClientInfo = lazy(() => import('@/pages/AdminClientInfo'));
const AdminClientInvoice = lazy(() => import('@/pages/AdminClientInvoice'));
const AdminRequirements = lazy(() => import('@/pages/AdminRequirements'));
const AdminSchedules = lazy(() => import('@/pages/AdminSchedules'));
const TeamsChat = lazy(() => import('@/pages/TeamsChat'));
const AdminMessages = lazy(() => import('@/pages/AdminMessages'));
const AdminReports = lazy(() => import('@/pages/AdminReports'));
const AdminSettings = lazy(() => import('@/pages/AdminSettings'));
const AgreementGenerator = lazy(() => import('@/pages/AgreementGenerator'));
const MockInterviewsDashboard = lazy(() => import('@/pages/MockInterviewsDashboard'));

// Manager Specific Pages (Lazy)
const ManagerDashboard = lazy(() => import('@/pages/ManagerDashboard'));
const ManagerMessages = lazy(() => import('@/pages/ManagerMessages'));

// Recruiter Pages (Lazy)
const RecruiterDashboard = lazy(() => import('@/pages/RecruiterDashboard'));
const RecruiterCandidates = lazy(() => import('@/pages/RecruiterCandidates'));
const RecruiterAssignments = lazy(() => import('@/pages/RecruiterAssignments'));
const RecruiterSchedules = lazy(() => import('@/pages/RecruiterSchedules'));
const MessagesRecruiters = lazy(() => import('@/pages/MessagesRecruiters'));
const RecruiterReports = lazy(() => import('@/pages/RecruiterReports'));
const RecruiterProfile = lazy(() => import('@/pages/RecruiterProfile'));
const RecruiterSettings = lazy(() => import('@/pages/RecruiterSettings'));

const LoadingFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-zinc-600 font-medium animate-pulse">Loading dashboard...</p>
  </div>
);

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, userRole, loading } = useAuth();

  if (loading) return <LoadingFallback />;

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
  const { userRole } = useAuth();

  return (
    <Suspense fallback={<LoadingFallback />}>
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
          <Route index element={userRole === 'manager' ? <ManagerDashboard /> : <AdminDashboard />} />
          <Route path="add-candidate" element={<AddCandidate />} />
          <Route path="my-candidates" element={<RecruiterCandidates />} />
          <Route path="recruiters" element={<AdminRecruiters />} />
          <Route path="clients" element={<AdminClientInfo />} />
          <Route path="invoices" element={<AdminClientInvoice />} />
          <Route path="requirements" element={<AdminRequirements />} />
          <Route path="schedules" element={<AdminSchedules />} />
          <Route path="messages" element={userRole === 'manager' ? <ManagerMessages /> : <AdminMessages />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="mock" element={<MockInterviewsDashboard />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="agreements" element={<AgreementGenerator />} />
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
          <Route path="mock" element={<MockInterviewsDashboard />} />
          <Route path="profile" element={<RecruiterProfile />} />
          <Route path="settings" element={<RecruiterSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster />
    </AuthProvider>
  );
}

export default App;