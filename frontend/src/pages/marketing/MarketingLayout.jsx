import { Outlet, Link, useNavigate } from 'react-router-dom';
import { BarChart3, Users, Zap, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MarketingLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold">Marketing</h1>
        </div>
        <nav className="p-4 space-y-2">
          <Link to="/marketing/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 text-gray-700">
            <BarChart3 size={20} /> Dashboard
          </Link>
          <Link to="/marketing/leads" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 text-gray-700">
            <Users size={20} /> My Leads
          </Link>
          <Link to="/marketing/referral-codes" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 text-gray-700">
            <Zap size={20} /> Referral Codes
          </Link>
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
