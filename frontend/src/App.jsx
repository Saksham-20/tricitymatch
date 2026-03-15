import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner, { PageSkeleton } from './components/common/LoadingSpinner';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminProtectedRoute from './components/admin/AdminProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import Navbar from './components/common/Navbar';
import BottomNav from './components/common/BottomNav';

// ==================== LAZY LOADED PAGES ====================
// Code splitting - each page is loaded only when needed

// Public pages (smaller, load faster)
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const ModernOnboarding = lazy(() => import('./pages/ModernOnboarding'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

// Modern Profile Editor (new)
const ModernProfileEditor = lazy(() => import('./pages/ModernProfileEditor'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminCreateUser = lazy(() => import('./pages/admin/AdminCreateUser'));
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminRevenue = lazy(() => import('./pages/admin/AdminRevenue'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

// Protected pages (load on demand)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const MyProfileView = lazy(() => import('./pages/MyProfileView'));
const ProfileDetail = lazy(() => import('./pages/ProfileDetail'));
const Search = lazy(() => import('./pages/Search'));
const Chat = lazy(() => import('./pages/Chat'));
const Subscription = lazy(() => import('./pages/Subscription'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentFailed = lazy(() => import('./pages/PaymentFailed'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const Settings = lazy(() => import('./pages/Settings'));
const Notifications = lazy(() => import('./pages/Notifications'));

// ==================== PAGE TRANSITION ====================

const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
    >
      {children}
    </motion.div>
  );
};

// ==================== SUSPENSE FALLBACK ====================

const SuspenseFallback = () => (
  <div className="min-h-[60vh]">
    <LoadingSpinner fullScreen message="Loading page..." />
  </div>
);

// ==================== ANIMATED ROUTES ====================

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<SuspenseFallback />}>
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={
            <PageTransition>
              <Home />
            </PageTransition>
          } />
          <Route path="/login" element={
            <PageTransition>
              <Login />
            </PageTransition>
          } />
          <Route path="/signup" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={
            <PageTransition>
              <ModernOnboarding />
            </PageTransition>
          } />
          <Route path="/forgot-password" element={
            <PageTransition>
              <ForgotPassword />
            </PageTransition>
          } />
          <Route path="/reset-password" element={
            <PageTransition>
              <ResetPassword />
            </PageTransition>
          } />
          <Route path="/terms" element={
            <PageTransition>
              <Terms />
            </PageTransition>
          } />
          <Route path="/privacy" element={
            <PageTransition>
              <Privacy />
            </PageTransition>
          } />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <MyProfileView />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <ModernProfileEditor />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <ProfileDetail />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Search />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Chat />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Subscription />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment/success"
            element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment/failed"
            element={
              <ProtectedRoute>
                <PaymentFailed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment/history"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <PaymentHistory />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Settings />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Notifications />
                </PageTransition>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes - bypass Navbar/BottomNav via AppContent check */}
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route
            path="/admin/*"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"     element={<AdminDashboard />} />
            <Route path="users"         element={<AdminUsers />} />
            <Route path="users/create"  element={<AdminCreateUser />} />
            <Route path="users/:userId" element={<AdminUserDetail />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="revenue"       element={<AdminRevenue />} />
            <Route path="reports"       element={<AdminReports />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

// ==================== APP CONTENT ====================

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  // Don't show bottom nav on chat page or admin pages (admin has its own nav)
  const showBottomNav = isAuthenticated && location.pathname !== '/chat' && !isAdminRoute;

  // Admin routes render without Navbar/BottomNav/Toaster
  if (isAdminRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
        </div>
      }>
        <AnimatedRoutes />
      </Suspense>
    );
  }
  
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary-500 focus:text-white"
      >
        Skip to main content
      </a>
      <Navbar />
      <main 
        id="main-content" 
        tabIndex="-1" 
        className={showBottomNav ? 'pb-20 md:pb-0' : ''}
      >
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </main>
      {showBottomNav && <BottomNav />}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#2D2D2D',
            borderRadius: '12px',
            border: '1px solid #E8E8E8',
            boxShadow: '0 10px 30px rgba(139, 35, 70, 0.1)',
            padding: '16px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#2E7D32',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#C62828',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
    </>
  );
};

// ==================== MAIN APP ====================

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OnboardingProvider>
          <SocketProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className="min-h-screen bg-background">
                <AppContent />
              </div>
            </Router>
          </SocketProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
