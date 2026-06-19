"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Clinic {
  id: string;
  clinicId: string;
  name: string;
  address: string;
  phone: string;
  logo: string | null;
  brandColor: string | null;
  isActive: boolean;
}

gsap.registerPlugin(useGSAP);

export default function Home() {
  const [activeClinics, setActiveClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);

  useEffect(() => {
    async function fetchClinics() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/clinics`);
        const data = await res.json();
        if (res.ok && data.clinics) {
          // Only keep clinics the admin has activated
          setActiveClinics(data.clinics.filter((c: Clinic) => c.isActive === true));
        }
      } catch {
        console.error("Failed to fetch clinics");
      } finally {
        setClinicsLoading(false);
      }
    }
    fetchClinics();
  }, []);

  const [view, setView] = useState<"signIn" | "signUp">("signIn");
  const formContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (formContainerRef.current) {
      const xOffset = view === "signIn" ? -30 : 30;
      gsap.fromTo(
        formContainerRef.current,
        { opacity: 0, x: xOffset },
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [view]);

  const [siEmployeeId, setSiEmployeeId] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siErrors, setSiErrors] = useState<{ employeeId?: string; password?: string }>({});
  const [siLoading, setSiLoading] = useState(false);
  const [siMessage, setSiMessage] = useState("");
  const [showSiPassword, setShowSiPassword] = useState(false);
  const [siMatchedClinic, setSiMatchedClinic] = useState<Clinic | null>(null);

  // Debounced lookup: when employee ID typed, fetch their clinic branding
  useEffect(() => {
    if (siEmployeeId.trim().length < 3) { setSiMatchedClinic(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/clinic-by-employee/${encodeURIComponent(siEmployeeId.trim())}`);
        const data = await res.json();
        setSiMatchedClinic(data.clinic || null);
      } catch {
        setSiMatchedClinic(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [siEmployeeId]);

  const [suName, setSuName] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suEmployeeId, setSuEmployeeId] = useState("");
  const [suClinicId, setSuClinicId] = useState("");
  const [suRole, setSuRole] = useState<"doctor" | "receptionist" | "clinic_admin" | "">("");
  const [suDepartment, setSuDepartment] = useState("");
  const [suDepartmentFocused, setSuDepartmentFocused] = useState(false);
  const deptInputRef = useRef<HTMLInputElement | null>(null);
  const [suCountryCode, setSuCountryCode] = useState("+1");
  const [suErrors, setSuErrors] = useState<Record<string, string>>({});
  const [suLoading, setSuLoading] = useState(false);
  const [suMessage, setSuMessage] = useState("");
  const [showSuPassword, setShowSuPassword] = useState(false);

  const matchedClinic = activeClinics.find(
    (c) => c.clinicId.trim().toUpperCase() === suClinicId.trim().toUpperCase()
  );

  const departmentOptions = ["Cardiology","Neurology","Pediatrics","Oncology","Orthopedics"];
  const filteredDepartments = departmentOptions.filter((option) =>
    option.toLowerCase().includes(suDepartment.toLowerCase())
  );
  const departmentExactMatch = filteredDepartments.length === 1 &&
    filteredDepartments[0].toLowerCase() === suDepartment.trim().toLowerCase();
  const showDepartmentSuggestions =
    suRole === "doctor" && (suDepartmentFocused || suDepartment.trim().length > 0) && !departmentExactMatch;

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function validatePhone(phone: string) {
    const pattern = /^[+\d][\d\s()\-]{6,20}$/;
    const digits = phone.replace(/\D/g, "").length;
    return pattern.test(phone) && digits >= 7 && digits <= 15;
  }
  const countryCodeOptions = [
    { code: "+1", label: "US +1" },
    { code: "+44", label: "UK +44" },
    { code: "+91", label: "IN +91" },
    { code: "+61", label: "AU +61" },
  ];
  function formatPhoneForCountry(code: string, value: string) {
    const digits = value.replace(/\D/g, "");
    if (code === "+1") {
      const a = digits.slice(0, 3); const b = digits.slice(3, 6); const c = digits.slice(6, 10);
      return [a, b, c].filter(Boolean).join("-");
    }
    if (code === "+91") {
      const a = digits.slice(0, 5); const b = digits.slice(5, 10);
      return [a, b].filter(Boolean).join("-");
    }
    if (code === "+44") {
      const a = digits.slice(0, 4); const b = digits.slice(4, 7); const c = digits.slice(7, 11);
      return [a, b, c].filter(Boolean).join("-");
    }
    const a = digits.slice(0, 3); const b = digits.slice(3, 6); const c = digits.slice(6, 10); const rest = digits.slice(10);
    const parts = [a, b, c].filter(Boolean);
    if (rest) parts.push(rest);
    return parts.join("-");
  }
  function passwordStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const pct = Math.min(100, Math.round((score / 4) * 100));
    let label = "Very weak"; let color = "bg-red-500";
    if (score >= 4) { label = "Strong"; color = "bg-emerald-500"; }
    else if (score === 3) { label = "Good"; color = "bg-yellow-400"; }
    else if (score === 2) { label = "Medium"; color = "bg-orange-400"; }
    return { score, pct, label, color };
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof siErrors = {};
    if (!siEmployeeId || siEmployeeId.trim().length < 3) errs.employeeId = "Please enter your Employee ID.";
    if (!siPassword) errs.password = "Password is required.";
    setSiErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSiLoading(true); setSiMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: matchedClinic ? matchedClinic.clinicId : "", employeeId: siEmployeeId.trim(), password: siPassword }),
      });
      const data = await response.json();
      if (!response.ok) { setSiMessage(data.error || "Login failed. Please try again."); return; }
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      setSiMessage("Login successful! Redirecting...");
      setTimeout(() => {
        if (data.user?.role === "doctor") window.location.href = "/doctor";
        else if (data.user?.role === "receptionist") window.location.href = "/receptionist";
        else if (data.user?.role === "clinic_admin") window.location.href = "/clinic-admin";
        else window.location.href = "/dashboard";
      }, 1500);
    } catch (error) { setSiMessage("Network error. Please check your connection and try again."); console.error(error); }
    finally { setSiLoading(false); }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!suName || suName.trim().length < 2) errs.name = "Please enter your name.";
    const combinedPhone = suPhone.startsWith("+") ? suPhone : `${suCountryCode}${suPhone}`;
    if (!suPhone || !validatePhone(combinedPhone)) errs.phone = "Please enter a valid phone number.";
    if (!suEmail || !validateEmail(suEmail)) errs.email = "Please enter a valid email.";
    if (!suPassword || suPassword.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!suRole) errs.role = "Please select a role.";
    if (suRole === "doctor" && !suDepartment) errs.department = "Please select a department.";
    if (!suEmployeeId || suEmployeeId.trim().length === 0) errs.employeeId = "Employee ID is required.";
    if (!suClinicId || suClinicId.trim().length === 0) errs.clinicId = "Clinic ID is required.";
    setSuErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSuLoading(true); setSuMessage("");
    const matchedClinicReg = activeClinics.find((c) => c.clinicId.trim().toUpperCase() === suClinicId.trim().toUpperCase());
    if (!matchedClinicReg) { setSuMessage("Registration failed: Invalid Clinic ID."); setSuLoading(false); return; }
    if (!matchedClinicReg.isActive) { setSuMessage("Registration failed: This clinic is currently Inactive."); setSuLoading(false); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: suName.trim(), phone: combinedPhone.trim(), email: suEmail.toLowerCase().trim(), password: suPassword, employeeId: suEmployeeId.trim(), role: suRole, department: suRole === "doctor" ? suDepartment.trim() : undefined, clinicId: matchedClinicReg.clinicId }),
      });
      const data = await response.json();
      if (!response.ok) { setSuMessage(data.error || "Registration failed. Please try again."); return; }
      setSuMessage("Account created successfully! Switching to login...");
      setTimeout(() => {
        setView("signIn"); setSuMessage(""); setSuName(""); setSuPhone(""); setSuCountryCode("+1");
        setSuEmail(""); setSuPassword(""); setSuEmployeeId(""); setSuRole(""); setSuDepartment("");
      }, 2000);
    } catch (error) { setSuMessage("Network error. Please check your connection and try again."); console.error(error); }
    finally { setSuLoading(false); }
  }

  // Derive brand color — use siMatchedClinic on sign-in, matchedClinic on sign-up
  const activeClinicForPanel = view === "signIn" ? (siMatchedClinic || matchedClinic) : matchedClinic;
  const brandColor = activeClinicForPanel?.brandColor || "#4f46e5";
  const brandColorLight = brandColor + "22";
  const brandColorMid = brandColor + "55";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-8">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">

        {/* ─── LEFT PANEL: Professional Abstract Branding ─── */}
        <div
          className="hidden md:flex flex-col relative overflow-hidden"
          style={{ background: brandColor, minHeight: "600px" }}
        >
          {/* Layer 1: Abstract SVG background — absolutely fills the panel */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 500 700"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="420" cy="80"  r="180" fill="white" fillOpacity="0.06" />
            <circle cx="60"  cy="600" r="220" fill="white" fillOpacity="0.05" />
            <circle cx="250" cy="350" r="300" fill="white" fillOpacity="0.03" />
            <circle cx="420" cy="80"  r="120" fill="none" stroke="white" strokeOpacity="0.10" strokeWidth="1" />
            <circle cx="420" cy="80"  r="70"  fill="none" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
            <circle cx="60"  cy="600" r="160" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="-50" y1="200" x2="600" y2="850" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
            <line x1="-50" y1="100" x2="600" y2="750" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
            <line x1="-50" y1="300" x2="600" y2="950" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
            <circle cx="380" cy="260" r="3"   fill="white" fillOpacity="0.30" />
            <circle cx="340" cy="290" r="2"   fill="white" fillOpacity="0.20" />
            <circle cx="410" cy="240" r="1.5" fill="white" fillOpacity="0.25" />
            <circle cx="100" cy="450" r="3"   fill="white" fillOpacity="0.20" />
            <circle cx="130" cy="480" r="2"   fill="white" fillOpacity="0.15" />
            <path d="M 30 30 L 30 70 M 30 30 L 70 30"   stroke="white" strokeOpacity="0.2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 470 670 L 470 630 M 470 670 L 430 670" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <line x1="400" y1="130" x2="480" y2="130" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="400" y1="145" x2="480" y2="145" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="400" y1="160" x2="480" y2="160" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="415" y1="115" x2="415" y2="175" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="430" y1="115" x2="430" y2="175" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="445" y1="115" x2="445" y2="175" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
            <line x1="460" y1="115" x2="460" y2="175" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
          </svg>

          {/* Layer 2: Logo — absolutely fills the entire panel as background */}
          {activeClinicForPanel?.logo && (
            <>
              {/* Full-panel logo cover */}
              <img
                src={activeClinicForPanel.logo}
                alt={`${activeClinicForPanel.name} logo`}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ opacity: 0.18 }}
              />
              {/* Centred crisp logo card on top */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    width: "72%",
                    aspectRatio: "16/9",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.14)",
                  }}
                >
                  <img
                    src={activeClinicForPanel.logo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* Bottom fade into brand color */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/3"
                    style={{ background: `linear-gradient(to top, ${brandColor}bb, transparent)` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Layer 3: Content (badge top, name bottom) — always on top */}
          <div className="relative z-10 flex flex-col justify-between h-full p-10" style={{ minHeight: "600px" }}>

            {/* Top badge */}
            <span
              className="self-start inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.95)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
              Authorized Portal
            </span>

            {/* No-logo fallback centered icon */}
            {!activeClinicForPanel?.logo && (
              <div className="flex-1 flex items-center justify-center">
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  <Image src="/next.svg" alt="default logo" width={72} height={22} className="invert brightness-200 opacity-80" />
                </div>
              </div>
            )}

            {/* Bottom: clinic name + address */}
            <div>
              <div className="h-px w-12 mb-5" style={{ background: "rgba(255,255,255,0.35)" }} />
              <h3 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm leading-tight">
                {activeClinicForPanel ? activeClinicForPanel.name : "Welcome to Hospital"}
              </h3>
              <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.65)" }}>
                {activeClinicForPanel ? activeClinicForPanel.address : "Securely manage your account and appointments."}
              </p>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Form ─── */}
        <div className="p-10 md:p-16 flex flex-col justify-center">
          <div className="mb-8 flex items-center justify-center">
            <div className="relative inline-flex items-center bg-zinc-100 dark:bg-slate-800 rounded-full p-1 w-72 h-14">
              <div
                className={`absolute top-1 left-1 w-1/2 h-12 rounded-full bg-white dark:bg-slate-700 shadow-md transform transition-transform duration-300 ${
                  view === "signUp" ? "translate-x-full" : ""
                }`}
              />
              <button
                onClick={() => setView("signIn")}
                disabled={siLoading || suLoading}
                className={`relative z-10 flex-1 h-12 rounded-md text-lg font-medium transition-colors disabled:opacity-50 ${
                  view === "signIn" ? "text-sky-600 dark:text-sky-400" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setView("signUp")}
                disabled={siLoading || suLoading}
                className={`relative z-10 flex-1 h-12 rounded-md text-lg font-medium transition-colors disabled:opacity-50 ${
                  view === "signUp" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Sign up
              </button>
            </div>
          </div>

          <div ref={formContainerRef}>
            {view === "signIn" ? (
              <>
                <h2 className="text-3xl font-semibold mb-3 text-sky-600 dark:text-sky-400">Welcome back</h2>
                <p className="text-base text-sky-500 dark:text-sky-300 mb-6">Sign in to continue to your account.</p>
                {siMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${siMessage.includes("error") || siMessage.includes("failed") ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {siMessage}
                  </div>
                )}
                <form onSubmit={handleSignIn} className="space-y-5">
                  <label className="block">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">Employee ID</span>
                    <input value={siEmployeeId} onChange={(e) => setSiEmployeeId(e.target.value.toUpperCase())} type="text" placeholder="E.g. EMP-12345" disabled={siLoading}
                      className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50" />
                    {siErrors.employeeId && <p className="mt-1 text-sm text-red-600">{siErrors.employeeId}</p>}
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">Password</span>
                    <div className="relative mt-2">
                      <input value={siPassword} onChange={(e) => setSiPassword(e.target.value)} type={showSiPassword ? "text" : "password"} placeholder="••••••••" disabled={siLoading}
                        className="block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 pr-24 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50" />
                      <button type="button" onClick={() => setShowSiPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 mr-3 flex items-center rounded-md px-3 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900">
                        {showSiPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {siErrors.password && <p className="mt-1 text-sm text-red-600">{siErrors.password}</p>}
                  </label>
                  <button type="submit" disabled={siLoading} className="w-full rounded-lg bg-sky-600 px-6 py-3 text-lg font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-opacity">
                    {siLoading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-semibold mb-3 text-emerald-600 dark:text-emerald-400">Create account</h2>
                <p className="text-base text-emerald-500 dark:text-emerald-300 mb-6">Start your free account — quick and secure.</p>
                {suMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${suMessage.includes("error") || suMessage.includes("failed") ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {suMessage}
                  </div>
                )}
                {!clinicsLoading && activeClinics.length === 0 ? (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
                    <strong>Registration Closed:</strong> No active clinics are available.
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Full name</span>
                      <input value={suName} onChange={(e) => setSuName(e.target.value)} name="name" type="text" placeholder="Your full name" disabled={suLoading}
                        className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50" />
                      {suErrors.name && <p className="mt-1 text-sm text-red-600">{suErrors.name}</p>}
                    </label>
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Phone number</span>
                      <div className="mt-2 flex items-center gap-2">
                        <select value={suCountryCode} onChange={(e) => { setSuCountryCode(e.target.value); setSuPhone(formatPhoneForCountry(e.target.value, suPhone)); }} disabled={suLoading}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-3 py-2 text-base focus:border-blue-500">
                          {countryCodeOptions.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
                        </select>
                        <input value={suPhone} onChange={(e) => setSuPhone(formatPhoneForCountry(suCountryCode, e.target.value))} name="phone" type="tel" placeholder="555 555 5555" disabled={suLoading}
                          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500" />
                      </div>
                      {suErrors.phone && <p className="mt-1 text-sm text-red-600">{suErrors.phone}</p>}
                    </label>
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Email</span>
                      <input value={suEmail} onChange={(e) => setSuEmail(e.target.value)} name="email" type="email" placeholder="you@example.com" disabled={suLoading}
                        className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
                      {suErrors.email && <p className="mt-1 text-sm text-red-600">{suErrors.email}</p>}
                    </label>
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Role</span>
                      <select value={suRole} onChange={(e) => setSuRole(e.target.value as "doctor" | "receptionist" | "clinic_admin" | "")} disabled={suLoading}
                        className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500">
                        <option value="">Select role</option>
                        <option value="doctor">Doctor</option>
                        <option value="receptionist">Receptionist</option>
                        <option value="clinic_admin">Clinic Admin</option>
                      </select>
                      {suErrors.role && <p className="mt-1 text-sm text-red-600">{suErrors.role}</p>}
                    </label>
                    {suRole === "doctor" && (
                      <label className="block relative">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">Department</span>
                        <div className="relative">
                          <input ref={deptInputRef} value={suDepartment} onChange={(e) => setSuDepartment(e.target.value)}
                            onFocus={() => setSuDepartmentFocused(true)} onBlur={() => setTimeout(() => setSuDepartmentFocused(false), 150)}
                            placeholder="Search and select department" disabled={suLoading}
                            className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500" />
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); setSuDepartmentFocused(true); deptInputRef.current?.focus(); }} disabled={suLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-zinc-600 dark:text-zinc-400">▼</button>
                        </div>
                        {showDepartmentSuggestions && (
                          <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 shadow-sm">
                            {filteredDepartments.length > 0 ? filteredDepartments.map((option) => (
                              <button key={option} type="button" onMouseDown={() => { setSuDepartment(option); setSuDepartmentFocused(false); }} disabled={suLoading}
                                className="w-full border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700">{option}</button>
                            )) : (
                              <div className="px-4 py-3 text-sm text-zinc-500">No results matched</div>
                            )}
                          </div>
                        )}
                        {suErrors.department && <p className="mt-1 text-sm text-red-600">{suErrors.department}</p>}
                      </label>
                    )}
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Password</span>
                      <div className="relative mt-2">
                        <input value={suPassword} onChange={(e) => setSuPassword(e.target.value)} name="password" type={showSuPassword ? "text" : "password"} placeholder="Choose a strong password" disabled={suLoading}
                          className="block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 pr-24 text-base focus:border-blue-500" />
                        <button type="button" onClick={() => setShowSuPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 mr-3 flex items-center rounded-md px-3 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900">
                          {showSuPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {suErrors.password && <p className="mt-1 text-sm text-red-600">{suErrors.password}</p>}
                      <div className="mt-3">
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div className={`${passwordStrength(suPassword).color} h-2 rounded-full transition-all`} style={{ width: `${passwordStrength(suPassword).pct}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                          <span>{passwordStrength(suPassword).label}</span>
                          <span>{suPassword.length} chars</span>
                        </div>
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Employee ID</span>
                      <input value={suEmployeeId} onChange={(e) => setSuEmployeeId(e.target.value)} name="employeeId" type="text" placeholder="E.g. EMP-12345" disabled={suLoading}
                        className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500" />
                      {suErrors.employeeId && <p className="mt-1 text-sm text-red-600">{suErrors.employeeId}</p>}
                    </label>
                    <label className="block">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Clinic ID</span>
                      <input value={suClinicId} onChange={(e) => setSuClinicId(e.target.value.toUpperCase())} name="clinicId" type="text" placeholder="E.g. CLINIC-ABCD" disabled={suLoading}
                        className="mt-2 block w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 text-base focus:border-blue-500" />
                      <p className="mt-1 text-xs text-zinc-500">Provided by your hospital administrator.</p>
                      {suClinicId.trim().length > 0 && (
                        matchedClinic
                          ? <p className="mt-1 text-xs font-medium text-emerald-600">✓ {matchedClinic.name} — verified and active</p>
                          : <p className="mt-1 text-xs font-medium text-amber-600">Clinic ID not found or clinic is inactive. Contact your administrator.</p>
                      )}
                      {suErrors.clinicId && <p className="mt-1 text-sm text-red-600">{suErrors.clinicId}</p>}
                    </label>
                    <button type="submit" disabled={suLoading} className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-lg font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-opacity">
                      {suLoading ? "Creating account..." : "Create account"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}