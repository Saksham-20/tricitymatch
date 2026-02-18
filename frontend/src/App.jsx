import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner, { PageSkeleton } from './components/common/LoadingSpinner';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';
import BottomNav from './components/common/BottomNav';

// ==================== LAZY LOADED PAGES ====================
// Code splitting - each page is loaded only when needed

// Public pages (smaller, load faster)
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Protected pages (load on demand)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileDetail = lazy(() => import('./pages/ProfileDetail'));
const Search = lazy(() => import('./pages/Search'));
const Discovery = lazy(() => import('./pages/Discovery'));
const Chat = lazy(() => import('./pages/Chat'));
const Subscription = lazy(() => import('./pages/Subscription'));

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
          <Route path="/signup" element={
            <PageTransition>
              <Signup />
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
                  <Profile />
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
            path="/discovery"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Discovery />
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
  
  // Don't show bottom nav on chat page (it has its own navigation)
  const showBottomNav = isAuthenticated && location.pathname !== '/chat';
  
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-rose-500 focus:text-white"
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
        <SocketProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-background">
              <AppContent />
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
