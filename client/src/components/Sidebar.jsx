import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, UserPlus, Briefcase, 
  Building2, Receipt, ClipboardList, MessageSquare, 
  BarChart3, Settings, Power, User
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar() {
  const { userRole, logout, currentUser } = useAuth();
  
  // -- Colors --
  const sidebarBg = "bg-[#283086]"; // Deep Royal Blue
  const activeBgClass = "bg-[#f3f6fd]"; // Matches Dashboard Background
  // Thick Blue Text for Active
  const activeTextClass = "text-[#283086] font-extrabold"; 
  // Thick White Text for Inactive
  const inactiveTextClass = "text-white font-bold hover:bg-white/10";

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Add Candidate', path: '/admin/add-candidate', icon: UserPlus },
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

  // Determine which links to show based on exact role
  let links = [];
  if (userRole === 'admin') {
    links = adminLinks;
  } else if (userRole === 'manager') {
    links = adminLinks.filter(
      (link) => link.name !== 'Client Info' && link.name !== 'Invoices'
    );
  } else {
    links = recruiterLinks;
  }

  return (
    <div className={clsx("flex flex-col h-screen fixed left-0 top-0 z-50 shadow-2xl w-80", sidebarBg)}>
      
      {/* --- Header / Logo --- */}
      <div className="h-28 flex items-center px-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10">
            <span className="text-white font-extrabold text-2xl">V</span>
          </div>
          <span className="text-white font-bold text-2xl tracking-tight whitespace-nowrap">
            VTS Tracker
          </span>
        </div>
      </div>

      {/* --- User Profile Card --- */}
      <div className="mb-8 px-6">
        <div className="bg-[#3d4692] rounded-2xl p-4 flex items-center gap-4 overflow-hidden shadow-inner border border-white/5">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 flex-shrink-0 overflow-hidden bg-gray-200 flex items-center justify-center">
             <User className="h-6 w-6 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentUser?.email || 'admin@vts.com'}</p>
            <p className="text-[11px] text-blue-200 uppercase font-bold mt-0.5 tracking-wide">{userRole} Account</p>
          </div>
        </div>
      </div>

      {/* --- Navigation Links --- */}
      <div className="flex-1 overflow-y-auto space-y-2 py-2 pl-6 pr-0 [&::-webkit-scrollbar]:hidden">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/admin' || link.path === '/recruiter'}
            // UPDATED: Changed py-5 to py-4 for slightly tighter spacing
            className={({ isActive }) =>
              clsx(
                "group flex items-center relative transition-all duration-200 py-4 pl-8",
                isActive 
                  ? `${activeBgClass} ${activeTextClass} rounded-l-[50px] rounded-r-none`
                  : `${inactiveTextClass} rounded-l-[50px]`
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* --- The "Cutout" Curves --- */}
                {isActive && (
                  <>
                    <div 
                      className="absolute right-0 -top-[30px] w-[30px] h-[30px] bg-transparent pointer-events-none z-10"
                      style={{
                        borderBottomRightRadius: '30px',
                        boxShadow: `6px 6px 0 6px #f3f6fd`
                      }}
                    />
                    <div 
                      className="absolute right-0 -bottom-[30px] w-[30px] h-[30px] bg-transparent pointer-events-none z-10"
                      style={{
                        borderTopRightRadius: '30px',
                        boxShadow: `6px -6px 0 6px #f3f6fd`
                      }}
                    />
                  </>
                )}

                <div className="flex items-center gap-5 z-20 relative w-full">
                  {/* UPDATED: Changed h-6 w-6 to h-5 w-5 (20px) */}
                  <link.icon 
                    className={clsx(
                      "h-5 w-5 flex-shrink-0 transition-transform duration-300", 
                      isActive ? "scale-110 stroke-[3px]" : "group-hover:scale-110 stroke-[2.5px]"
                    )} 
                  />
                  {/* UPDATED: Changed text-[17px] to text-[15px] */}
                  <span className="text-[15px] tracking-wide">{link.name}</span>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* --- Sign Out Button --- */}
      <div className="p-8 mt-auto">
        <button 
          onClick={logout} 
          className="flex items-center gap-4 w-full px-6 py-4 bg-red-600 text-white hover:bg-red-700 transition-all rounded-2xl shadow-lg group"
        >
          {/* UPDATED: Icon size h-5 w-5 */}
          <Power className="h-5 w-5 group-hover:scale-110 transition-transform stroke-[3px]" />
          {/* UPDATED: Text size text-[15px] */}
          <span className="font-extrabold tracking-wide text-[15px]">Sign Out</span>
        </button>
      </div>
    </div>
  );
}