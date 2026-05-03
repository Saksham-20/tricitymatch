import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiGrid, FiUsers, FiCheckCircle, FiCreditCard,
  FiTrendingUp, FiFlag, FiLogOut, FiMenu, FiX,
  FiChevronRight, FiTag, FiUserPlus, FiPhoneCall,
} from 'react-icons/fi';

const navItems = [
  { to: '/admin/dashboard',        label: 'Dashboard',         icon: FiGrid },
  { to: '/admin/users',            label: 'Users',             icon: FiUsers },
  { to: '/admin/verifications',    label: 'Verifications',     icon: FiCheckCircle },
  { to: '/admin/subscriptions',    label: 'Subscriptions',     icon: FiCreditCard },
  { to: '/admin/revenue',          label: 'Revenue',           icon: FiTrendingUp },
  { to: '/admin/reports',          label: 'Reports',           icon: FiFlag },
  { to: '/admin/marketing-users',  label: 'Marketing Users',   icon: FiUserPlus },
  { to: '/admin/referral-codes',   label: 'Referral Codes',    icon: FiTag },
  { to: '/admin/leads',            label: 'Leads',             icon: FiPhoneCall },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-gray-900 ${mobile ? 'w-72' : 'w-64'}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-700 flex items-center justify-center">
            <span className="text-white text-xs font-black">TC</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">TricityMatch</p>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-rose-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <FiChevronRight className="w-3 h-3 opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin info + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="px-3 py-2 rounded-lg bg-gray-800 mb-2">
          <p className="text-xs font-medium text-white truncate">{user?.firstName || 'Admin'} {user?.lastName || ''}</p>
          <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all duration-150"
        >
          <FiLogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiMenu className="w-6 h-6" />
          </button>
          <span className="text-white text-sm font-semibold">TricityMatch Admin</span>
          <div className="w-6" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
