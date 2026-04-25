import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare,
  BarChart2, Settings, LogOut, ChevronLeft, ChevronRight,
  User, ClipboardList, Building2, FileText, UserCheck,
  Menu, X, BrainCircuit
} from 'lucide-react';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/candidates', label: 'Candidates', icon: Users },
  { to: '/admin/recruiters', label: 'Recruiters', icon: UserCheck },
  { to: '/admin/clients', label: 'Clients', icon: Building2 },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  { to: '/admin/requirements', label: 'Requirements', icon: ClipboardList },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/mock', label: 'AI Mock', icon: BrainCircuit },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const recruiterLinks = [
  { to: '/recruiter', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/recruiter/candidates', label: 'My Candidates', icon: Users },
  { to: '/recruiter/assignments', label: 'Assignments', icon: Briefcase },
  { to: '/recruiter/schedules', label: 'Schedules', icon: Calendar },
  { to: '/recruiter/messages', label: 'Messages', icon: MessageSquare },
  { to: '/recruiter/mock', label: 'AI Mock', icon: BrainCircuit },
  { to: '/recruiter/reports', label: 'Reports', icon: BarChart2 },
  { to: '/recruiter/profile', label: 'Profile', icon: User },
  { to: '/recruiter/settings', label: 'Settings', icon: Settings },
];

export function DashboardSidebar({ collapsed, onToggle }) {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = userRole === 'admin' ? adminLinks : recruiterLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div className={`flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-700 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
        {(!collapsed || isMobile) && (
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 truncate">
            {userRole === 'admin' ? 'Admin Panel' : 'Recruiter CMS'}
          </span>
        )}
        {!isMobile && (
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {collapsed ? <ChevronRight className="h-5 w-5"/> : <ChevronLeft className="h-5 w-5"/>}
          </button>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-gray-500">
            <X className="h-5 w-5"/>
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${collapsed && !isMobile ? 'justify-center' : ''}`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0"/>
            {(!collapsed || isMobile) && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        {(!collapsed || isMobile) && user && (
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{userRole}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <LogOut className="h-5 w-5 flex-shrink-0"/>
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 shadow rounded-lg md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5 text-gray-600"/>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)}/>
          <div className="relative z-50 w-64 bg-white dark:bg-gray-900 h-full shadow-2xl">
            <SidebarContent isMobile/>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent/>
      </aside>
    </>
  );
}

export default DashboardSidebar;
