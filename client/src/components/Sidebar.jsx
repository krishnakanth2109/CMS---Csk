import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, UserPlus, Briefcase, 
  Building2, Receipt, ClipboardList, MessageSquare, 
  BarChart3, Settings, Power, User, Users,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { userRole, logout, currentUser } = useAuth();
  
  // -- Colors --
  const sidebarBg = "bg-[#283086]"; 
  const mainBackgroundColor = "#f3f6fd"; 
  const activeBgClass = `bg-[${mainBackgroundColor}]`; 
  
  const activeTextClass = "text-[#283086] font-extrabold"; 
  const inactiveTextClass = "text-white font-medium hover:bg-white/10 rounded-l-[50px]";

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'OverAll Candidates', path: '/admin/add-candidate', icon: Users }, 
    { name: 'Recruiters', path: '/admin/recruiters', icon: Briefcase },
    { name: 'Client Info', path: '/admin/clients', icon: Building2 },
    { name: 'Invoices', path: '/admin/invoices', icon: Receipt },
    { name: 'Requirements', path: '/admin/requirements', icon: ClipboardList },
    { name: 'Messages', path: '/admin/messages', icon: MessageSquare },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Settings', path: '/admin/settings', icon: Settings }, 
  ];

  const recruiterLinks = [
    { name: 'Dashboard', path: '/recruiter', icon: LayoutDashboard },
    { name: 'My Candidates', path: '/recruiter/candidates', icon: UserPlus },
    { name: 'Assignments', path: '/recruiter/assignments', icon: Briefcase },
    { name: 'Schedules', path: '/recruiter/schedules', icon: ClipboardList },
    { name: 'Messages', path: '/recruiter/messages', icon: MessageSquare },
    { name: 'Reports', path: '/recruiter/reports', icon: BarChart3 },
    { name: 'My Profile', path: '/recruiter/profile', icon: User },
    { name: 'Settings', path: '/recruiter/settings', icon: Settings },
  ];

  let links = [];
  if (userRole === 'admin') {
    links = adminLinks;
  } else if (userRole === 'manager') {
    const filteredAdminLinks = adminLinks.filter(
      (link) => link.name !== 'Client Info' && link.name !== 'Invoices'
    );
    const myCandidatesLink = { 
      name: 'My Candidates', 
      path: '/recruiter/candidates', 
      icon: UserPlus 
    };
    links = [
      filteredAdminLinks[0], filteredAdminLinks[1], myCandidatesLink, ...filteredAdminLinks.slice(2) 
    ];
  } else {
    links = recruiterLinks;
  }

  return (
    <div 
      className={clsx(
        "flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300",
        sidebarBg,
        isOpen ? "w-80" : "w-20"
      )}
    >
      
      {/* --- Toggle Button --- */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-12 bg-white text-[#283086] rounded-full p-1 shadow-md hover:scale-110 transition-transform z-50 border border-gray-200"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* --- Header / Logo --- */}
      <div className={clsx("h-28 flex items-center transition-all duration-300", isOpen ? "px-8" : "justify-center px-0")}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10">
            <span className="text-white font-extrabold text-2xl">V</span>
          </div>
          <span className={clsx("text-white font-bold text-2xl tracking-tight whitespace-nowrap transition-opacity duration-200", isOpen ? "opacity-100 block" : "opacity-0 hidden")}>
            VTS Tracker
          </span>
        </div>
      </div>

      {/* --- User Profile Card --- */}
      <div className={clsx("mb-8 transition-all duration-300", isOpen ? "px-6" : "px-2")}>
        <div className={clsx("bg-[#3d4692] rounded-2xl flex items-center overflow-hidden shadow-inner border border-white/5 transition-all", isOpen ? "p-4 gap-4" : "p-2 justify-center")}>
          
          {/* UPDATED: Profile Image logic */}
          <div className="w-10 h-10 rounded-full border-2 border-white/20 flex-shrink-0 overflow-hidden bg-gray-200 flex items-center justify-center">
             {currentUser?.profilePicture ? (
               <img src={currentUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User className="h-5 w-5 text-gray-500" />
             )}
          </div>

          <div className={clsx("flex-1 min-w-0 transition-opacity duration-200", isOpen ? "opacity-100 block" : "opacity-0 hidden")}>
            {/* UPDATED: Show Name, Fallback to Email */}
            <p className="text-sm font-bold text-white truncate">
              {currentUser?.name || currentUser?.email || 'User'}
            </p>
            <p className="text-[11px] text-blue-200 uppercase font-bold mt-0.5 tracking-wide">
              {userRole} Account
            </p>
          </div>
        </div>
      </div>

      {/* --- Navigation Links --- */}
      <div className={clsx("flex-1 overflow-y-auto space-y-2 py-2 pr-0 [&::-webkit-scrollbar]:hidden", isOpen ? "pl-6" : "pl-2")}>
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/admin' || link.path === '/recruiter'}
            className={({ isActive }) =>
              clsx(
                "group flex items-center relative transition-all duration-200 py-4",
                isActive 
                  ? `${activeBgClass} ${activeTextClass} rounded-l-[50px] rounded-r-none`
                  : inactiveTextClass,
                isOpen ? "pl-8 justify-start" : "justify-center pl-0"
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* --- SEAMLESS CURVES --- */}
                {isActive && (
                  <>
                    <div 
                      className="absolute right-0 -top-8 w-8 h-8 bg-transparent pointer-events-none z-50"
                      style={{
                        borderBottomRightRadius: '100%', 
                        boxShadow: `15px 15px 0 15px ${mainBackgroundColor}` 
                      }}
                    />
                    <div 
                      className="absolute right-0 -bottom-8 w-8 h-8 bg-transparent pointer-events-none z-50"
                      style={{
                        borderTopRightRadius: '100%',
                        boxShadow: `15px -15px 0 15px ${mainBackgroundColor}`
                      }}
                    />
                  </>
                )}

                <div className={clsx("flex items-center z-20 relative transition-all duration-300", isOpen ? "gap-5" : "gap-0")}>
                  <link.icon 
                    className={clsx(
                      "h-5 w-5 flex-shrink-0 transition-transform duration-300", 
                      isActive ? "scale-110 stroke-[3px]" : "group-hover:scale-110 stroke-[2.5px]"
                    )} 
                  />
                  <span className={clsx("text-[15px] tracking-wide whitespace-nowrap transition-all duration-200 overflow-hidden", 
                    isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
                  )}>
                    {link.name}
                  </span>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* --- Sign Out Button --- */}
      <div className={clsx(
        "mt-auto transition-all duration-300", 
        isOpen ? "pl-6 pr-6 mb-6" : "pl-2 pr-2 mb-4"
      )}>
        <button 
          onClick={logout} 
          className={clsx(
            "flex items-center w-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg group relative overflow-hidden",
            isOpen ? "justify-start pl-8 py-4 gap-5 rounded-2xl" : "justify-center p-3 rounded-2xl"
          )}
          title="Sign Out"
        >
          <Power className="h-6 w-6 flex-shrink-0 group-hover:scale-110 transition-transform stroke-[3px]" />
          <span className={clsx("font-extrabold tracking-wide text-base transition-all duration-200 overflow-hidden whitespace-nowrap", isOpen ? "block" : "hidden w-0")}>
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );
}