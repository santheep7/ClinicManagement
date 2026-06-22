"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import AdminSidebar from "../../components/SideNavbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ADMIN_SECRET = "super-secret-admin-key-2026";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Clinic {
  id: string;
  clinicId: string;
  name: string;
  address: string;
  phone?: string;
  logo?: string | null;
  brandColor?: string | null;
  status: "Active" | "Inactive";
}

interface Doctor {
  id: string;
  name: string;
  role: string;
  faculty: string;
  since?: string;
  initials?: string;
}

interface Department {
  id: string;
  name: string;
  doctors: Doctor[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_PRESETS = [
  "#0ea5e9", "#2563eb", "#7c3aed",
  "#db2777", "#f59e0b", "#10b981",
];

const DEPT_COLOURS = [
  { bg: "#FBEAF0", color: "#993556" },
  { bg: "#EEEDFE", color: "#534AB7" },
  { bg: "#E6F1FB", color: "#185FA5" },
  { bg: "#EAF3DE", color: "#3B6D11" },
  { bg: "#FAEEDA", color: "#854F0B" },
  { bg: "#E1F5EE", color: "#0F6E56" },
  { bg: "#FAECE7", color: "#993C1D" },
];

function deptColour(i: number) { return DEPT_COLOURS[i % DEPT_COLOURS.length]; }

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Image compression ────────────────────────────────────────────────────────
// Compresses an image file to a JPEG data URI at the given max dimension and quality.
// Keeps the payload well within typical backend JSON body limits (~10 MB).
function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminDashboard() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);

  // Add-form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState("");
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [brandColor, setBrandColor] = useState(BRAND_PRESETS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Detail modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [staffData, setStaffData] = useState<Department[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [editLogo, setEditLogo] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBrand, setEditBrand] = useState(BRAND_PRESETS[0]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // ─── Animations ────────────────────────────────────────────────────────────
  useGSAP(() => {
    if (!containerRef.current) return;

    const has = (selector: string) => containerRef.current?.querySelector(selector);

    if (has(".animate-header")) {
      gsap.from(".animate-header", { y: -20, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" });
    }

    if (has(".animate-panel")) {
      gsap.from(".animate-panel", { y: 30, opacity: 0, duration: 0.6, stagger: 0.2, ease: "power3.out", delay: 0.2 });
    }

    if (has(".animate-input")) {
      gsap.from(".animate-input", { x: -20, opacity: 0, duration: 0.4, stagger: 0.1, ease: "back.out(1.7)", delay: 0.5 });
    }

    if (has(".animate-btn")) {
      gsap.from(".animate-btn", { scale: 0.9, opacity: 0, duration: 0.4, ease: "elastic.out(1, 0.7)", delay: 0.8 });
    }
  }, { scope: containerRef });

  const animateModalIn = useCallback(() => {
    if (!modalRef.current) return;
    gsap.fromTo(modalRef.current, { opacity: 0, scale: 0.92, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power3.out" });
  }, []);
  const animateModalOut = useCallback((cb: () => void) => {
    if (!modalRef.current) return cb();
    gsap.to(modalRef.current, { opacity: 0, scale: 0.93, y: 18, duration: 0.22, ease: "power2.in", onComplete: cb });
  }, []);

  // ─── Data ──────────────────────────────────────────────────────────────────
  const fetchClinics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinics/admin/all`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      const data = await res.json();
      if (res.ok && data.clinics) {
        setClinics(data.clinics.map((c: Clinic & { isActive: boolean }) => ({
          ...c, status: c.isActive ? "Active" : "Inactive",
        })));
      }
    } catch { console.error("Failed to fetch clinics"); }
  }, []);

  const fetchStaff = async (clinicId: string) => {
    setStaffLoading(true); setStaffError(""); setStaffData([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinics/${clinicId}/staff`, { headers: { "x-admin-secret": ADMIN_SECRET } });
      const data = await res.json();
      if (res.ok && data.departments) setStaffData(data.departments);
      else setStaffError(data.error || "Failed to load staff data.");
    } catch { setStaffError("Network error — could not load staff."); }
    finally { setStaffLoading(false); }
  };

  useEffect(() => {
    if (localStorage.getItem("isAdminAuthenticated")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthChecked(true);
      fetchClinics();
    } else {
      router.push("/admin/login");
    }
  }, [router, fetchClinics]);

  const closeModal = useCallback(() => {
    animateModalOut(() => {
      setModalOpen(false); setSelectedClinic(null); setStaffData([]); setStaffError("");
    });
  }, [animateModalOut]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editOpen) setEditOpen(false);
        else if (modalOpen) closeModal();
      }
    };
    if (modalOpen || editOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, editOpen, closeModal]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = () => { localStorage.removeItem("isAdminAuthenticated"); router.push("/"); };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Logo must be under 5 MB."); return; }
    try {
      const compressed = await compressImage(file);
      setLogo(compressed); setLogoUrlInput("");
    } catch { setError("Failed to process image. Please try another file."); }
  };
  const handleLogoUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setLogoUrlInput(v); setLogo(v);
  };

  const handleAddClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMessage(""); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ name, address, phone, logo: logo || undefined, brandColor }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Clinic added! Clinic ID: ${data.clinic.clinicId}`);
        setName(""); setAddress(""); setPhone(""); setLogo(""); setLogoUrlInput("");
        setBrandColor(BRAND_PRESETS[0]);
        fetchClinics();
      } else setError(data.error || "Failed to add clinic");
    } catch { setError("Network error occurred."); }
    finally { setLoading(false); }
  };

  const toggleClinicStatus = async (c: Clinic) => {
    const next = c.status !== "Active";
    setClinics(prev => prev.map(x => x.id === c.id ? { ...x, status: next ? "Active" : "Inactive" } : x));
    try {
      await fetch(`${API_BASE_URL}/api/clinics/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ isActive: next }),
      });
    } catch { fetchClinics(); }
  };

  const openClinicDetail = (clinic: Clinic) => {
    setSelectedClinic(clinic); setModalOpen(true); fetchStaff(clinic.id);
    requestAnimationFrame(() => requestAnimationFrame(animateModalIn));
  };

  // ─── Edit handlers ─────────────────────────────────────────────────────────
  const openEditClinic = (c: Clinic) => {
    setEditingClinic(c);
    setEditLogo(c.logo || "");
    setEditLogoUrl(c.logo && c.logo.startsWith("http") ? c.logo : "");
    setEditBrand(c.brandColor || BRAND_PRESETS[0]);
    setEditError("");
    setEditOpen(true);
  };
  const handleEditLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setEditError("Logo must be under 5 MB."); return; }
    try {
      const compressed = await compressImage(file);
      setEditLogo(compressed); setEditLogoUrl("");
    } catch { setEditError("Failed to process image. Please try another file."); }
  };
  const handleEditLogoUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setEditLogoUrl(v); setEditLogo(v);
  };
  const saveEdit = async () => {
    if (!editingClinic) return;
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/clinics/${editingClinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ logo: editLogo || null, brandColor: editBrand }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "Failed to update clinic."); return; }
      setEditOpen(false); setEditingClinic(null);
      fetchClinics();
    } catch { setEditError("Network error."); }
    finally { setEditSaving(false); }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (formRef.current) {
      gsap.fromTo(formRef.current,
        { boxShadow: "0 0 0px rgba(37,99,235,0)" },
        { boxShadow: "0 0 24px rgba(37,99,235,0.45)", duration: 0.4, yoyo: true, repeat: 1 });
    }
  };

  // ─── Hover/focus helpers ───────────────────────────────────────────────────
  const handleHoverEnter = (e: React.MouseEvent<HTMLLIElement>) => {
    gsap.fromTo(e.currentTarget,
      { y: 0, scale: 1, boxShadow: "0px 0px 0px rgba(0,0,0,0)", borderColor: "#e2e8f0" },
      { y: -6, scale: 1.02, boxShadow: "0px 10px 20px rgba(37,99,235,0.08)", borderColor: "#2563eb", duration: 0.3, ease: "power2.out" });
  };
  const handleHoverLeave = (e: React.MouseEvent<HTMLLIElement>) => {
    gsap.fromTo(e.currentTarget,
      { y: -6, scale: 1.02, boxShadow: "0px 10px 20px rgba(37,99,235,0.08)", borderColor: "#2563eb" },
      { y: 0, scale: 1, boxShadow: "0px 0px 0px rgba(0,0,0,0)", borderColor: "#e2e8f0", duration: 0.3, ease: "power2.out" });
  };
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    gsap.to(e.target, { scale: 1.02, duration: 0.3, ease: "power2.out", boxShadow: "0px 0px 8px rgba(37,99,235,0.4)", borderColor: "#2563eb" });
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) =>
    gsap.to(e.target, { scale: 1, duration: 0.3, ease: "power2.out", boxShadow: "none", borderColor: "#e2e8f0" });

  // ─── Derived ───────────────────────────────────────────────────────────────
  const totalDoctors = staffData.reduce((s, d) => s + d.doctors.length, 0);
  const facultyMap: Record<string, number> = {};
  staffData.forEach(d => d.doctors.forEach(doc => { if (doc.faculty) facultyMap[doc.faculty] = (facultyMap[doc.faculty] || 0) + 1; }));

  if (!authChecked) return null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar onLogout={handleLogout} onClinicsClick={scrollToForm} />

      <div ref={containerRef} className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-md">

          <div className="animate-header flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800">Admin Mode</h1>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors">Logout</button>
          </div>
          <div className="animate-header text-slate-600 mb-8">
            <p>Welcome to the Admin Dashboard. Manage clinics and staff here.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ─── Add Clinic Form ─── */}
            <div ref={formRef} className="animate-panel bg-slate-50 p-6 rounded-lg border transition-shadow">
              <h2 className="text-xl font-semibold mb-4">Add New Clinic</h2>

              {message && <div className="mb-4 p-3 bg-emerald-100 text-emerald-800 rounded">{message}</div>}
              {error   && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

              <form onSubmit={handleAddClinic} className="space-y-4">
                <div className="animate-input">
                  <label className="block text-sm font-medium mb-1">Clinic Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    onFocus={handleFocus} onBlur={handleBlur}
                    className="w-full px-3 py-2 border rounded-md text-slate-800 focus:outline-none"
                    placeholder="e.g. City Central Clinic" />
                </div>

                <div className="animate-input">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input type="text" required value={address} onChange={e => setAddress(e.target.value)}
                    onFocus={handleFocus} onBlur={handleBlur}
                    className="w-full px-3 py-2 border rounded-md text-slate-800 focus:outline-none"
                    placeholder="123 Health St." />
                </div>

                <div className="animate-input">
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input type="text" required value={phone} onChange={e => setPhone(e.target.value)}
                    onFocus={handleFocus} onBlur={handleBlur}
                    className="w-full px-3 py-2 border rounded-md text-slate-800 focus:outline-none"
                    placeholder="555-0100" />
                </div>

                <div className="animate-input">
                  <label className="block text-sm font-medium mb-1">Clinic Logo</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed bg-white flex items-center justify-center overflow-hidden shrink-0"
                      style={{ borderColor: brandColor }}>
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="logo preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input type="file" accept="image/*" onChange={handleLogoFile}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      <input type="url" value={logoUrlInput} onChange={handleLogoUrl}
                        onFocus={handleFocus} onBlur={handleBlur}
                        placeholder="…or paste image URL (https://…)"
                        className="w-full px-3 py-1.5 text-sm border rounded-md text-slate-800 focus:outline-none" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">PNG/JPG/SVG, max 5 MB. Or paste a hosted URL.</p>
                </div>

                <div className="animate-input">
                  <label className="block text-sm font-medium mb-1">Brand Color</label>
                  <div className="flex items-center gap-2">
                    {BRAND_PRESETS.map(c => (
                      <button type="button" key={c} onClick={() => setBrandColor(c)}
                        aria-label={`Brand color ${c}`}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${brandColor === c ? "scale-110 border-slate-800" : "border-white"} shadow-sm`}
                        style={{ background: c }} />
                    ))}
                    <span className="ml-2 text-xs font-mono text-slate-500">{brandColor}</span>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="animate-btn w-full text-white py-2 rounded-md hover:opacity-90 disabled:opacity-50 font-medium transition-opacity"
                  style={{ background: brandColor }}>
                  {loading ? "Adding..." : "Add Clinic"}
                </button>
              </form>
            </div>

            {/* ─── Clinics List ─── */}
            <div className="animate-panel bg-slate-50 p-6 rounded-lg border">
              <h2 className="text-xl font-semibold mb-1">Active Clinics</h2>
              <p className="text-xs text-slate-400 mb-4">Click a clinic to view doctors &amp; departments</p>

              {clinics.length === 0 ? (
                <p className="text-sm text-slate-500">No clinics found.</p>
              ) : (
                <ul className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                  {clinics.map(clinic => {
                    const accent = clinic.brandColor || "#2563eb";
                    return (
                      <li key={clinic.id}
                        onMouseEnter={handleHoverEnter} onMouseLeave={handleHoverLeave}
                        onClick={() => openClinicDetail(clinic)}
                        className="relative p-4 bg-white border border-slate-200 rounded-xl shadow-sm transition-all duration-200 list-none cursor-pointer select-none overflow-hidden">
                        <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} />

                        <div className="flex justify-between items-start pl-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden shrink-0"
                              style={{ borderColor: `${accent}55` }}>
                              {clinic.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={clinic.logo} alt={clinic.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold" style={{ color: accent }}>{getInitials(clinic.name)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-lg text-slate-800 truncate">{clinic.name}</div>
                              <div className="text-sm text-slate-500 truncate">{clinic.address}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap"
                            style={{ background: `${accent}15`, color: accent }}>
                            View staff →
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between pl-2">
                          <div className="text-sm font-mono px-2.5 py-1 rounded-md font-semibold"
                            style={{ background: `${accent}15`, color: accent }}>
                            ID: {clinic.clinicId}
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => openEditClinic(clinic)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                              Edit
                            </button>
                            <span className={`text-xs font-bold ${clinic.status === "Active" ? "text-green-600" : "text-slate-400"}`}>
                              {clinic.status}
                            </span>
                            <button type="button" onClick={() => toggleClinicStatus(clinic)}
                              aria-label={`Toggle ${clinic.name} status`}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${clinic.status === "Active" ? "bg-green-500" : "bg-slate-300"}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${clinic.status === "Active" ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ─── Clinic Detail Modal ─── */}
        {modalOpen && selectedClinic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={closeModal}>
            <div ref={modalRef} onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-start px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  {selectedClinic.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedClinic.logo} alt="" className="w-12 h-12 rounded-lg border border-slate-200 object-cover" />
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{selectedClinic.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selectedClinic.address}{selectedClinic.phone && ` · ${selectedClinic.phone}`}
                    </p>
                    <span className="inline-block mt-2 text-xs font-mono px-2.5 py-1 rounded-md font-semibold"
                      style={{ background: `${selectedClinic.brandColor || "#2563eb"}15`, color: selectedClinic.brandColor || "#2563eb" }}>
                      {selectedClinic.clinicId}
                    </span>
                  </div>
                </div>
                <button onClick={closeModal} aria-label="Close"
                  className="ml-4 mt-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {!staffLoading && !staffError && staffData.length > 0 && (
                <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
                  <SummaryCard label="Total doctors" value={totalDoctors} icon="🩺" />
                  <SummaryCard label="Departments"   value={staffData.length} icon="🏥" />
                  <SummaryCard label="Faculty types" value={Object.keys(facultyMap).length} icon="🎓" />
                </div>
              )}

              <div className="overflow-y-auto flex-1 px-6 py-5">
                {staffLoading && <p className="text-sm text-slate-400 text-center py-12">Loading staff data…</p>}
                {staffError && !staffLoading && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{staffError}</div>}
                {!staffLoading && !staffError && staffData.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <p className="text-4xl mb-3">🏥</p>
                    <p className="text-sm font-medium text-slate-500">No staff assigned yet</p>
                  </div>
                )}

                {!staffLoading && !staffError && staffData.map((dept, deptIdx) => {
                  const c = deptColour(deptIdx);
                  return (
                    <div key={dept.id ?? dept.name} className="mb-6 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{dept.name}</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
                          {dept.doctors.length} {dept.doctors.length === 1 ? "doctor" : "doctors"}
                        </span>
                      </div>
                      <div className="space-y-2 pl-4">
                        {dept.doctors.map(doc => (
                          <div key={doc.id ?? doc.name}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-all">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: c.bg, color: c.color }}>
                              {doc.initials ?? getInitials(doc.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{doc.name}</p>
                              <p className="text-xs text-slate-500 truncate">{doc.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Edit Clinic Modal ─── */}
        {editOpen && editingClinic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setEditOpen(false)}>
            <div onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Edit Branding</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editingClinic.name}</p>
                </div>
                <button onClick={() => setEditOpen(false)} aria-label="Close"
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {editError && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{editError}</div>}

              <label className="block text-sm font-medium mb-1">Clinic Logo</label>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed bg-white flex items-center justify-center overflow-hidden shrink-0"
                  style={{ borderColor: editBrand }}>
                  {editLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editLogo} alt="logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input type="file" accept="image/*" onChange={handleEditLogoFile}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  <input type="url" value={editLogoUrl} onChange={handleEditLogoUrl}
                    placeholder="…or paste image URL"
                    className="w-full px-3 py-1.5 text-sm border rounded-md text-slate-800 focus:outline-none" />
                  {editLogo && (
                    <button type="button"
                      onClick={() => { setEditLogo(""); setEditLogoUrl(""); }}
                      className="text-xs text-red-600 hover:underline">
                      Remove logo
                    </button>
                  )}
                </div>
              </div>

              <label className="block text-sm font-medium mb-1">Brand Color</label>
              <div className="flex items-center gap-2 mb-6">
                {BRAND_PRESETS.map(c => (
                  <button type="button" key={c} onClick={() => setEditBrand(c)}
                    aria-label={`Brand color ${c}`}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${editBrand === c ? "scale-110 border-slate-800" : "border-white"} shadow-sm`}
                    style={{ background: c }} />
                ))}
                <span className="ml-2 text-xs font-mono text-slate-500">{editBrand}</span>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setEditOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: editBrand }}>
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}