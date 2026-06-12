"use client";

import {
  LayoutDashboard,
  Building2,
  Palette,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

interface Props {
  onLogout: () => void;
}

export default function AdminSidebar({ onLogout }: Props) {
  return (
    <aside className="w-72 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold">🏥 Admin Panel</h1>
        <p className="text-slate-400 text-sm mt-1">
          Clinic Management
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600">
          <LayoutDashboard size={18} />
          Dashboard
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800">
          <Building2 size={18} />
          Clinics
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800">
          <Palette size={18} />
          Branding
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800">
          <Users size={18} />
          Doctors
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800">
          <Settings size={18} />
          Settings
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}