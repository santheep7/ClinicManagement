"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UserProfile {
  id: string;
  fullName: string;
  role: string;
  employeeId: string;
  clinicId?: string;
}

interface VitalConfig {
  id: string;
  clinicId: string;
  department: string;
  vitals: string[];
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

const MASTER_VITALS = [
  { key: "bloodPressure",   label: "Blood Pressure",    unit: "mmHg",  icon: "🩺", desc: "Systolic/diastolic pressure" },
  { key: "heartRate",       label: "Heart Rate",        unit: "bpm",   icon: "💓", desc: "Pulse beats per minute" },
  { key: "temperature",     label: "Temperature",       unit: "°F",    icon: "🌡️", desc: "Body core temperature" },
  { key: "spO2",            label: "SpO₂",              unit: "%",     icon: "🫁", desc: "Oxygen saturation level" },
  { key: "respiratoryRate", label: "Respiratory Rate",   unit: "/min",  icon: "💨", desc: "Breaths taken per minute" },
  { key: "weight",          label: "Weight",            unit: "kg",    icon: "⚖️", desc: "Patient weight in kilograms" },
  { key: "height",          label: "Height",            unit: "cm",    icon: "📏", desc: "Patient height in centimeters" },
  { key: "iop",             label: "IOP (L / R)",       unit: "mmHg",  icon: "👁️", desc: "Intraocular pressure (Left/Right)" },
  { key: "peakFlow",        label: "Peak Flow",         unit: "L/min", icon: "🌬️", desc: "Maximum expiratory flow speed" },
  { key: "bloodGlucose",    label: "Blood Glucose",     unit: "mg/dL", icon: "🩸", desc: "Sugar level in bloodstream" },
  { key: "painScore",       label: "Pain Score",        unit: "/ 10",  icon: "😢", desc: "Subjective pain level (0-10)" },
];

const DEFAULT_DEPARTMENTS = [
  "Cardiology",
  "Dermatology",
  "ENT",
  "Endocrinology",
  "Gastroenterology",
  "General",
  "Gynecology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Urology",
];

export default function ClinicAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [configs, setConfigs] = useState<VitalConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedDept, setSelectedDept] = useState("Cardiology");
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [customDeptName, setCustomDeptName] = useState("");
  const [selectedVitals, setSelectedVitals] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as UserProfile;
      if (parsedUser.role !== "clinic_admin" && parsedUser.role !== "admin") {
        // Redirect non-admins
        router.push("/dashboard");
        return;
      }
      setUser(parsedUser);

      // fetchConfigs is declared below; call it after it exists.
      // We use an IIFE + await to ensure ordering without relying on microtask timing.
      (async () => {
        await fetchConfigs(token);
      })();
    } catch (e) {
      console.error(e);
      router.push("/");
    }
  }, [router]);

  const fetchConfigs = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vital-configs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.configs) {
        setConfigs(data.configs);
      } else {
        addToast(data.error || "Failed to load configurations.", "error");
      }
    } catch {
      addToast("Network error: Could not fetch configurations.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleVitalToggle = (key: string) => {
    setSelectedVitals((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    setIsSaving(true);

    const deptName = isCustomDept ? customDeptName.trim() : selectedDept;
    if (!deptName) {
      addToast("Please enter or select a department name.", "error");
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/vital-configs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          department: deptName,
          vitals: selectedVitals,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(`Successfully updated vitals configuration for ${deptName}!`, "success");
        // Reset custom input
        setCustomDeptName("");
        // Reload configs
        fetchConfigs(token);
      } else {
        addToast(data.error || "Failed to save configuration.", "error");
      }
    } catch {
      addToast("Network error: Could not save configuration.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async (deptName: string) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    if (!confirm(`Are you sure you want to remove configured vitals for ${deptName}? It will fallback to standard default vitals.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/vital-configs/${encodeURIComponent(deptName)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204) {
        addToast(`Cleared configuration for ${deptName}.`, "success");
        fetchConfigs(token);
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to delete configuration.", "error");
      }
    } catch {
      addToast("Network error: Could not delete configuration.", "error");
    }
  };

  const handleEditConfigClick = (cfg: VitalConfig) => {
    const isStandard = DEFAULT_DEPARTMENTS.includes(cfg.department);
    if (isStandard) {
      setSelectedDept(cfg.department);
      setIsCustomDept(false);
    } else {
      setIsCustomDept(true);
      setCustomDeptName(cfg.department);
    }
    setSelectedVitals(cfg.vitals);

    // Smooth scroll to form
    formRef.current?.scrollIntoView({ behavior: "smooth" });
    gsap.fromTo(
      formRef.current,
      { outline: "2px solid transparent" },
      { outline: "2px solid #3b82f6", duration: 0.5, yoyo: true, repeat: 1 }
    );
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-medium">Verifying clinic credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageContainerRef} className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 bg-slate-900 text-white flex flex-col justify-between shrink-0 p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
              A
            </div>
            <div>
              <h2 className="font-extrabold text-base leading-tight">Clinic Admin</h2>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Workspace Manager</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Account Details</p>
            <h4 className="font-bold text-sm text-slate-200 truncate mt-1">{user.fullName}</h4>
            <p className="text-xs text-slate-500 mt-0.5">Emp ID: {user.employeeId}</p>
            <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Clinic Admin
            </span>
          </div>

          <nav className="space-y-1.5 pt-4">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 font-semibold text-left text-sm transition-all shadow-md shadow-blue-500/10">
              <span>🛠️</span>
              Vitals Config
            </button>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 text-rose-400 hover:bg-rose-950/20 font-semibold text-sm transition-colors mt-6"
        >
          <span>🚪</span>
          Logout Manager
        </button>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-200">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Configure Department Vitals</h1>
              <p className="text-sm text-slate-500 mt-1">
                Customize the vital metrics captured during consultation for each clinical department.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Clinic Live Settings
            </div>
          </header>



          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Configurations List */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-2">Active Department Layouts</h3>
                <p className="text-xs text-slate-400 mb-6">These configurations override the default global system vitals.</p>

                {configs.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-2xl border-slate-200 bg-slate-50/50">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="text-sm font-semibold text-slate-500">No custom vital layouts set</p>
                    <p className="text-xs text-slate-400 mt-1">All departments currently utilize default global vitals.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {[...configs]
                      .sort((a, b) => a.department.localeCompare(b.department))
                      .map((cfg) => (
                      <div
                        key={cfg.id}
                        className="p-5 bg-slate-50/60 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-slate-50"
                      >
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800 text-base">{cfg.department}</h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {cfg.vitals.map((vKey) => {
                              const found = MASTER_VITALS.find((m) => m.key === vKey);
                              return (
                                <span
                                  key={vKey}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white border text-slate-600 shadow-sm"
                                >
                                  <span>{found?.icon || "🩺"}</span>
                                  {found?.label || vKey}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => handleEditConfigClick(cfg)}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 hover:border-blue-200"
                          >
                            Edit Layout
                          </button>
                          <button
                            onClick={() => handleDeleteConfig(cfg.department)}
                            className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Configuration Form */}
            <form
              ref={formRef}
              onSubmit={handleSaveConfig}
              className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 self-start"
            >
              <div>
                <h3 className="text-lg font-black text-slate-900">Define Vitals Layout</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select a department and pick its vital requirements.</p>
              </div>

              {/* Department Picker */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">Department</label>
                
                <div className="flex items-center gap-4 mb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isCustomDept}
                      onChange={() => setIsCustomDept(false)}
                      className="text-blue-600"
                    />
                    Standard List
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="radio"
                      checked={isCustomDept}
                      onChange={() => setIsCustomDept(true)}
                      className="text-blue-600"
                    />
                    Custom / New Dept
                  </label>
                </div>

                {!isCustomDept ? (
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-slate-700 bg-white text-sm"
                  >
                    {DEFAULT_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={customDeptName}
                    onChange={(e) => setCustomDeptName(e.target.value)}
                    placeholder="e.g. Cardiology Pediatrics"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-slate-700 text-sm"
                  />
                )}
              </div>

              {/* Vitals Checkboxes */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400">Select Vitals</label>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                    {selectedVitals.length} selected
                  </span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                  {MASTER_VITALS.map((vital) => {
                    const isChecked = selectedVitals.includes(vital.key);
                    return (
                      <div
                        key={vital.key}
                        onClick={() => handleVitalToggle(vital.key)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                          isChecked
                            ? "bg-blue-50/50 border-blue-200 shadow-sm"
                            : "bg-white border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // toggled by parent div click
                          className="w-4 h-4 rounded text-blue-600 border-slate-200 focus:ring-blue-400"
                        />
                        <div className="text-base shrink-0">{vital.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 truncate">{vital.label}</p>
                          <p className="text-[10px] text-slate-400 truncate">{vital.desc}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">{vital.unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVitals([])}
                  className="px-4 py-3 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors"
                >
                  Clear Selection
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-blue-500/15"
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>

          </div>

        </div>
      </main>

      {/* Floating Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl transition-all duration-300 transform scale-100 ${
              t.type === "success"
                ? "border-emerald-100 text-emerald-800 dark:border-emerald-950 dark:text-emerald-300"
                : "border-rose-100 text-rose-800 dark:border-rose-950 dark:text-rose-300"
            }`}
            style={{
              boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.15)",
              animation: "toast-in 0.35s cubic-bezier(0.21, 1.02, 0.43, 1.01) forwards",
            }}
          >
            <span className="text-base">{t.type === "success" ? "✅" : "❌"}</span>
            <p className="text-xs font-bold leading-tight">{t.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-black pl-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toast-in {
          0% { transform: translateY(-16px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

    </div>
  );
}
