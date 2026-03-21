import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, UserPlus, Briefcase, 
  Building2, Receipt, ClipboardList, MessageSquare, 
  BarChart3, Settings, Power, User, Users, Calendar 
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { userRole, logout, currentUser } = useAuth();
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const sidebarBg = "bg-[#283086]"; 
  const mainBackgroundColor = "#f3f6fd"; 
  const activeBgClass = "bg-[#f3f6fd]"; 
  const activeTextClass = "text-[#283086] font-extrabold"; 
  const inactiveTextClass = "text-white font-medium hover:bg-white/10";

  // Manager links
  const managerLinks = [
    { name: 'Dashboard',          path: '/admin',                   icon: LayoutDashboard },
    { name: 'OverAll Candidates', path: '/admin/add-candidate',     icon: Users }, 
    { name: 'Recruiters',         path: '/admin/recruiters',        icon: Briefcase },
    { name: 'Client Info',        path: '/admin/clients',           icon: Building2 },
    { name: 'Invoices',           path: '/admin/invoices',          icon: Receipt },
    { name: 'Requirements',       path: '/admin/requirements',      icon: ClipboardList },
    { name: 'Schedules',          path: '/admin/schedules',         icon: Calendar },
    { name: 'Messages',           path: '/admin/messages',  icon: MessageSquare },
    { name: 'Reports',            path: '/admin/reports',           icon: BarChart3 },
    { name: 'Settings',           path: '/admin/settings',          icon: Settings }, 
  ];

  // Recruiter links
  const recruiterLinks = [
    { name: 'Dashboard',    path: '/recruiter',            icon: LayoutDashboard },
    { name: 'My Candidates',path: '/recruiter/candidates', icon: UserPlus },
    { name: 'Assignments',  path: '/recruiter/assignments',icon: Briefcase },
    { name: 'Schedules',    path: '/recruiter/schedules',  icon: Calendar },
    { name: 'Messages',     path: '/recruiter/messages',   icon: MessageSquare },
    { name: 'Reports',      path: '/recruiter/reports',    icon: BarChart3 },
    { name: 'My Profile',   path: '/recruiter/profile',    icon: User },
    { name: 'Settings',     path: '/recruiter/settings',   icon: Settings },
  ];

  let links = [];
  if (userRole === 'manager') {
    links = managerLinks;
  } else if (userRole === 'admin') {
    links = [
      { name: 'Dashboard',          path: '/admin',               icon: LayoutDashboard },
      { name: 'OverAll Candidates', path: '/admin/add-candidate', icon: Users },
      { name: 'My Candidates',      path: '/admin/my-candidates', icon: UserPlus },
      { name: 'Recruiters',         path: '/admin/recruiters',    icon: Briefcase },
      { name: 'Requirements',       path: '/admin/requirements',  icon: ClipboardList },
      { name: 'Schedules',          path: '/admin/schedules',     icon: Calendar },
      { name: 'Messages',           path: '/admin/messages',      icon: MessageSquare },
      { name: 'Reports',            path: '/admin/reports',       icon: BarChart3 },
      { name: 'Settings',           path: '/admin/settings',      icon: Settings },
    ];
  } else {
    links = recruiterLinks;
  }

  return (
    <>
      <div className={clsx("flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300", sidebarBg, isOpen ? "w-80" : "w-20")}>
        
        {/* --- Toggle Button --- */}
        <button 
          onClick={toggleSidebar} 
          className="absolute -right-4 top-12 bg-white text-[#283086] rounded-lg p-1.5 shadow-md z-50 border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="Toggle Sidebar"
        >
          {isOpen ? (
            // Collapse Icon (Left-pointing arrow with left border)
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="4" ry="4" />
              <line x1="8" y1="4" x2="8" y2="20" />
              <polyline points="15 8 11 12 15 16" />
            </svg>
          ) : (
            // Expand Icon (Right-pointing arrow with left border)
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="4" ry="4" />
              <line x1="8" y1="4" x2="8" y2="20" />
              <polyline points="11 8 15 12 11 16" />
            </svg>
          )}
        </button>

        {/* --- Header / Logo --- */}
        <div className={clsx("h-28 flex items-center transition-all duration-300", isOpen ? "px-8" : "justify-center px-0")}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10">
              <span className="text-white font-extrabold text-2xl">V</span>
            </div>
            <span className={clsx("text-white font-bold text-2xl tracking-tight transition-opacity", isOpen ? "opacity-100 block" : "opacity-0 hidden")}>VTS Tracker</span>
          </div>
        </div>

        {/* --- User Profile Card --- */}
        <div className={clsx("mb-2 transition-all duration-300", isOpen ? "px-6" : "px-2")}>
          <div className={clsx("bg-white/10 backdrop-blur-md rounded-full flex items-center overflow-hidden border border-white/10 transition-all", isOpen ? "p-3 gap-4" : "p-2 justify-center")}>
            <div className="w-10 h-10 rounded-full border-2 border-white/20 flex-shrink-0 overflow-hidden bg-gray-200">
               {currentUser?.profilePicture ? <img src={currentUser.profilePicture} className="w-full h-full object-cover" /> : <User className="h-full w-full p-2 text-gray-500" />}
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentUser?.name || currentUser?.username || currentUser?.email || 'User'}</p>
                <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">
                  {userRole === 'admin' ? 'Admin' : userRole === 'manager' ? 'Manager' : 'Recruiter'} Account
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- Navigation Links --- */}
        <div className={clsx("flex-1 overflow-y-auto space-y-1 pt-8 pb-8 pr-0 relative [&::-webkit-scrollbar]:hidden", isOpen ? "pl-6" : "pl-2")}>
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/admin' || link.path === '/recruiter'}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center relative py-4 select-none outline-none focus:outline-none focus:ring-0",
                  isActive
                    ? `${activeBgClass} ${activeTextClass}`
                    : `${inactiveTextClass} transition-colors duration-200`,
                  isOpen ? "pl-8 rounded-l-[40px]" : "justify-center pl-0 rounded-xl mx-2"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && isOpen && (
                    <>
                      <div
                        className="absolute right-0 -top-[30px] w-[30px] h-[30px] bg-transparent pointer-events-none"
                        style={{
                          borderBottomRightRadius: '30px',
                          boxShadow: `15px 15px 0 15px ${mainBackgroundColor}`,
                        }}
                      />
                      <div
                        className="absolute right-0 -bottom-[30px] w-[30px] h-[30px] bg-transparent pointer-events-none"
                        style={{
                          borderTopRightRadius: '30px',
                          boxShadow: `15px -15px 0 15px ${mainBackgroundColor}`,
                        }}
                      />
                    </>
                  )}
                  <div className={clsx("flex items-center z-20 relative", isOpen ? "gap-5" : "gap-0")}>
                    <link.icon className={clsx(
                      "h-5 w-5",
                      isActive ? "scale-110 stroke-[3px]" : "stroke-[2.5px]"
                    )} />
                    {isOpen && <span className="text-[15px] tracking-wide whitespace-nowrap">{link.name}</span>}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* --- Sign Out Button --- */}
        <div className={clsx("mt-auto p-4 mb-4", isOpen ? "px-6" : "px-2")}>
          <button 
            onClick={() => setShowLogoutModal(true)} 
            className={clsx("flex items-center w-full bg-red-600 hover:bg-red-700 text-white py-4 gap-4 transition-all shadow-lg", isOpen ? "rounded-2xl px-8" : "rounded-xl justify-center")}
          >
            <Power className="h-6 w-6 flex-shrink-0" />
            {isOpen && <span className="font-extrabold whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* --- Logout Confirmation Modal --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Power className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign Out</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure you want to sign out of your account?</p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={logout}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-200 transition-colors"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}