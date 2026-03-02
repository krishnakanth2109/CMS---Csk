import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import clsx from 'clsx';

export default function DashboardLayout() {
  // State to manage sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    // Background color #f3f6fd matches the Sidebar active tab color
    <div className="min-h-screen bg-[#f3f6fd] flex font-sans text-slate-800">
      
      {/* Pass state and toggle function to Sidebar */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* 
        Main content wrapper 
        - Uses dynamic margin-left based on sidebar state 
        - w-80 is approx 20rem (320px)
        - w-20 is approx 5rem (80px)
      */}
      <div 
        className={clsx(
          "flex-1 min-h-screen flex flex-col transition-all duration-300 ease-in-out",
          isSidebarOpen ? "ml-80" : "ml-20"
        )}
      >
        <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}