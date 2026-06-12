"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  fullName?: string;
  role?: string;
}

export default function DoctorDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const doctorName = user?.fullName || "Santheep";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 max-w-xl mx-auto space-y-6">
      
      {/* Instead of returning an entirely separate tree layout, 
        we conditionally swap out ONLY the changing internal contents.
      */}
      {!mounted ? (
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400 animate-pulse">
              Loading clinical workspace...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Header Container */}
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold tracking-wider text-sky-600 uppercase">
                Doctor
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Dr. {doctorName}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Clinical workspace</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors border border-red-100 shadow-sm"
            >
              Logout
            </button>
          </div>

          {/* Metrics List Block */}
          <div className="space-y-3">
            {[
              { label: "Patient Queue", count: 0, customClass: "bg-sky-50/60 text-sky-900 border-sky-100" },
              { label: "Examination", count: 0, customClass: "border-slate-100 text-slate-700 bg-white" },
              { label: "Schedule", count: 0, customClass: "border-slate-100 text-slate-700 bg-white" },
              { label: "Completed", count: 0, customClass: "border-slate-100 text-slate-700 bg-white" },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm transition-all ${item.customClass}`}
              >
                <span className="font-semibold text-base">{item.label}</span>
                <span className={`flex items-center justify-center font-bold text-sm w-8 h-8 rounded-full ${
                  item.label === "Patient Queue" ? "bg-white shadow-sm" : "bg-slate-100 text-slate-800"
                }`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>

          {/* Today Patient Flow Workspace Panel */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                Today
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Patient flow</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                View the queue, take the next patient, and record examination notes.
              </p>
            </div>

            {/* Inner Tracking Queues */}
            <div className="space-y-4">
              {[
                { label: "Waiting", count: 0 },
                { label: "Examining", count: 0 },
                { label: "Done", count: 0 }
              ].map((flow, index) => (
                <div 
                  key={index} 
                  className="p-5 rounded-2xl border border-slate-100 bg-slate-50/40"
                >
                  <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    {flow.label}
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    {flow.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}