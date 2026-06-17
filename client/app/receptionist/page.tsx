"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  patientId?: string;
  queueId?: string;
  token?: string;
  tokenSession?: string;
  isVip?: boolean;
  followUp?: string;
  visitType?: "new" | "revisit" | "followup" | "appointment";
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  doctor: string;
  doctorId: string;
  department: string;
  reason: string;
  priority: string;
  status: string;
  bloodPressure?: string;
  heartRate?: string | number;
  temperature?: string;
  checkInTime: string;
}

interface User {
  fullName: string;
  role: string;
}

interface DoctorOption {
  id: string;
  name: string;
  department: string;
}

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  timeSlot: string;
  reason: string;
  status: "booked" | "confirmed" | "cancelled";
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  patientName: string;
  patientId: string;
  date: string;
  service: string;
  doctor: string;
  department: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentMode: string;
  status: "Paid" | "Pending" | "Partial" | "Cancelled";
  referenceNo: string;
  notes: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const SERVICE_OPTIONS = [
  "General Consultation",
  "Lab Test",
  "X-Ray / Scan",
  "Procedure",
  "Pharmacy",
  "Emergency",
  "Follow-up",
  "Admission",
  "Surgery",
  "Physiotherapy",
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Insurance", "Bank Transfer", "Cheque"];

const STATUS_STYLES: Record<PaymentRecord["status"], string> = {
  Paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border border-amber-200",
  Partial: "bg-sky-50 text-sky-700 border border-sky-200",
  Cancelled: "bg-rose-50 text-rose-700 border border-rose-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(total: number, paid: number): PaymentRecord["status"] {
  if (paid <= 0) return "Pending";
  if (paid >= total) return "Paid";
  return "Partial";
}

function fmtCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
function handleUnauthorized(status: number) {
  if (status === 401) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/";
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReceptionistDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Active tab: "dashboard" | "register" | "appointments" | "payments"
  const [activeTab, setActiveTab] = useState<"dashboard" | "register" | "appointments" | "payments">("dashboard");

  // ── Appointment booking state — DB backed ──
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setAppointments(data.appointments || []);
      } catch { /* silent */ }
    };
    load();
  }, [mounted]);

  // Booking wizard steps
  const [bookDept, setBookDept] = useState("");
  const [bookDoctorId, setBookDoctorId] = useState("");
  const [bookDoctorName, setBookDoctorName] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [bookSlot, setBookSlot] = useState("");
  const [bookPatientName, setBookPatientName] = useState("");
  const [bookPatientPhone, setBookPatientPhone] = useState("");
  const [bookReason, setBookReason] = useState("");
  const [apptFilter, setApptFilter] = useState<"all" | "booked" | "confirmed" | "cancelled">("all");

  // ── Queue / Check-in state ──
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [doctor, setDoctor] = useState("");
  const [department, setDepartment] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("Low");
  const [message, setMessage] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [requestedVipToken, setRequestedVipToken] = useState<number | "">("");
  const [visitType, setVisitType] = useState<"new" | "revisit" | "followup">("new");
  const [revisitPatientId, setRevisitPatientId] = useState("");
  const [sourceAppointmentId, setSourceAppointmentId] = useState<string | null>(null);

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSection, setSidebarSection] = useState<"queue" | "patients">("queue");
  const [completedPatients, setCompletedPatients] = useState<QueueItem[]>([]);

  // ── Payment state ──
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [payMessage, setPayMessage] = useState("");
  const [payMessageType, setPayMessageType] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [fPatientName, setFPatientName] = useState("");
  const [fPatientId, setFPatientId] = useState("");
  const [fDate, setFDate] = useState(todayISO());
  const [fService, setFService] = useState("");
  const [fDoctorId, setFDoctorId] = useState("");
  const [fDoctorName, setFDoctorName] = useState("");
  const [fDepartment, setFDepartment] = useState("");
  const [fTotalAmount, setFTotalAmount] = useState("");
  const [fAmountPaid, setFAmountPaid] = useState("");
  const [fPaymentMode, setFPaymentMode] = useState("");
  const [fReferenceNo, setFReferenceNo] = useState("");
  const [fNotes, setFNotes] = useState("");

  // ── Auth guard & Hydration Sync ──
  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { window.location.href = "/"; return; }
    try {
      const parsed = JSON.parse(storedUser) as User;
      if (parsed.role !== "receptionist") {
        window.location.href = parsed.role === "doctor" ? "/doctor" : "/";
        return;
      }
      setUser(parsed);
    } catch {
      window.location.href = "/";
    }

    try {
      const storedCompleted = localStorage.getItem("completedPatients");
      if (storedCompleted) {
        setCompletedPatients(JSON.parse(storedCompleted));
      }
    } catch {}
  }, []);

  // ── Load patient queue ──
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const loadQueue = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) { handleUnauthorized(response.status); return; }
        const data = await response.json();
        const all: QueueItem[] = data.patients || [];
        // Split: completed go to sidebar patients, rest stay in queue
        const done    = all.filter((p: QueueItem) => p.status === "completed");
        const active  = all.filter((p: QueueItem) => p.status !== "completed");
        setQueue(active);
        if (done.length > 0) {
          setCompletedPatients(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newOnes = done.filter((d: QueueItem) => !existingIds.has(d.id));
            return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
          });
        }
      } catch (error) {
        console.error("Queue fetch error:", error);
      }
    };

    loadQueue();
    // Poll every 30 seconds so completed patients auto-move
    const pollInterval = setInterval(loadQueue, 30000);
    return () => clearInterval(pollInterval);
  }, [mounted]);

  // ── Load doctors ──
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const loadDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/doctors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) { handleUnauthorized(response.status); throw new Error(`Server status: ${response.status}`); }
        const data = await response.json();
        setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
      } catch (error) {
        console.error("Unable to query active doctor entities:", error);
      }
    };
    loadDoctors();
  }, [mounted]);

  // ── Load payments ──
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const loadPayments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setPayments(data.payments || []);
      } catch (error) {
        console.error("Failed to load payments:", error);
      }
    };
    loadPayments();
  }, [mounted]);

  // ── Queue helpers ──
  function formatPhone(code: string, value: string) {
    const digits = value.replace(/\D/g, "");
    if (code === "+1") {
      const area = digits.slice(0, 3);
      const prefix = digits.slice(3, 6);
      const line = digits.slice(6, 10);
      return [area, prefix, line].filter(Boolean).join("-");
    }
    return digits;
  }

  function handleDoctorChange(value: string) {
    const selected = doctors.find((item) => item.id === value);
    setDoctorId(value);
    setDoctor(selected?.name || "");
    setDepartment(selected?.department || "");
  }

  // ── Pre-fill check-in form from a booked appointment ─────────────────────
  function checkInFromAppointment(appt: Appointment) {
    setName(appt.patientName);
    setPhone(appt.patientPhone);
    setDoctorId(appt.doctorId);
    setDoctor(appt.doctorName);
    setDepartment(appt.department);
    setReason(appt.reason || `Appointment – ${appt.department}`);
    setVisitType("new");
    setSourceAppointmentId(appt.id);
    setAge(""); setGender("Male"); setAddress("");
    setBp(""); setPulse(""); setTemperature("");
    setPriority("Medium");
    setIsVip(false); setRequestedVipToken("");
    setActiveTab("dashboard");
    setMessage(`✓ Appointment loaded — please fill in vitals and address for ${appt.patientName}`);
    setTimeout(() => setMessage(""), 5000);
  }

  async function handleAddToQueue(event: React.FormEvent) {
    event.preventDefault();
    if (!name || !age || !phone || !address || !reason) {
      setMessage("Please complete all required fields before queuing the patient.");
      return;
    }
    const storedUser = localStorage.getItem("user");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    
    // Non-digits are stripped out before calculating to avoid passing NaN values
    const cleanPulse = pulse.replace(/\D/g, "");

    const payload = {
      name: name.trim(),
      age: Number(age),
      gender,
      phone: phone.trim(),
      address: address.trim(),
      department,
      reason: reason.trim(),
      priority,
      bloodPressure: bp.trim() || undefined,
      heartRate: cleanPulse ? Number(cleanPulse) : undefined,
      temperature: temperature.trim() || undefined,
      checkInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      doctorId: doctorId || undefined,
      clinicId: parsedUser?.clinicId || "",
      isVip,
      requestedToken: isVip && requestedVipToken ? Number(requestedVipToken) : undefined,
      visitType,
    };
    const token = localStorage.getItem("accessToken");
    if (!token) { alert("Authentication token missing. Please sign back in."); return; }
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        setQueue((current) => [data.patient, ...current]);
        setMessage(`Patient checked in. Token: ${data.patient.token || "—"}`);
        setName(""); setAge(""); setGender("Male"); setPhone(""); setAddress("");
        setReason(""); setPriority("Low"); setBp(""); setPulse(""); setTemperature("");
        setDoctorId(""); setDoctor(""); setDepartment("");
        setIsVip(false); setRequestedVipToken("");
        setVisitType("new"); setRevisitPatientId("");
        if (sourceAppointmentId) {
          const token2 = localStorage.getItem("accessToken");
          await fetch(`${API_BASE_URL}/api/appointments/${sourceAppointmentId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
            body: JSON.stringify({ status: "confirmed" }),
          });
          setAppointments(prev => prev.map(a => a.id === sourceAppointmentId ? { ...a, status: "confirmed" as const } : a));
          setSourceAppointmentId(null);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to save record: ${errData.message || response.statusText}`);
      }
    } catch (error) {
      console.error("Network communication error:", error);
      alert("Network Error: Could not save patient dataset.");
    }
    setTimeout(() => setMessage(""), 3000);
  }

  async function removeQueueItem(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const patient = queue.find(q => q.id === id);
    if (patient && patient.status === "completed") {
      setCompletedPatients(prev => {
        if (prev.some(p => p.id === id)) return prev;
        return [patient, ...prev];
      });
      setQueue(current => current.filter(item => item.id !== id));
      setMessage("Patient moved to Patients section.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setQueue((current) => current.filter((item) => item.id !== id));
        setMessage("Patient removed from queue.");
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(`Server refused deletion. Status: ${response.status}`);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }

  // ── Payment helpers ──
  function handlePayDoctorChange(id: string) {
    const selected = doctors.find((d) => d.id === id);
    setFDoctorId(id);
    setFDoctorName(selected?.name || "");
    setFDepartment(selected?.department || "");
  }

  function showPayMessage(text: string, type: "success" | "error" = "success") {
    setPayMessage(text);
    setPayMessageType(type);
    setTimeout(() => setPayMessage(""), 3500);
  }

  function clearPayForm() {
    setFPatientName(""); setFPatientId(""); setFDate(todayISO());
    setFService(""); setFDoctorId(""); setFDoctorName(""); setFDepartment("");
    setFTotalAmount(""); setFAmountPaid(""); setFPaymentMode("");
    setFReferenceNo(""); setFNotes("");
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!fPatientName.trim() || !fTotalAmount || !fAmountPaid || !fDate) {
      showPayMessage("Please fill in all required fields.", "error");
      return;
    }
    const total = parseFloat(fTotalAmount) || 0;
    const paid = parseFloat(fAmountPaid) || 0;
    const due = Math.max(0, total - paid);
    const payload = {
      patientName: fPatientName.trim(),
      patientId: fPatientId.trim(),
      date: fDate,
      service: fService || "General Consultation",
      doctor: fDoctorName,
      department: fDepartment,
      doctorId: fDoctorId,
      totalAmount: total,
      amountPaid: paid,
      amountDue: due,
      paymentMode: fPaymentMode || "Cash",
      status: deriveStatus(total, paid),
      referenceNo: fReferenceNo.trim(),
      notes: fNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    const token = localStorage.getItem("accessToken");
    if (!token) { alert("Session expired. Please log in again."); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setPayments((prev) => [data.payment, ...prev]);
        clearPayForm();
        showPayMessage(`Payment recorded for ${payload.patientName}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showPayMessage(err.message || "Failed to save payment.", "error");
      }
    } catch (error) {
      console.error("Payment save error:", error);
      showPayMessage("Network error.", "error");
    }
  }

  async function handleDeletePayment(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPayments((prev) => prev.filter((p) => p.id !== id));
        showPayMessage("Payment record deleted.");
      } else {
        showPayMessage("Failed to delete record.", "error");
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  }

  // Sync state transitions to client storage safely
  useEffect(() => {
    if (mounted) {
      try { localStorage.setItem("completedPatients", JSON.stringify(completedPatients)); } catch {}
    }
  }, [completedPatients, mounted]);

  // Controlled queue verification hook block 
  useEffect(() => {
    const done = queue.filter(q => q.status === "completed");
    if (done.length > 0) {
      setCompletedPatients(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newOnes = done.filter(d => !existingIds.has(d.id));
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
      setQueue(current => current.filter(q => q.status !== "completed"));
    }
  }, [queue]);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  // ── Derived values ──
  const totalCollected = payments.reduce((s, p) => s + p.amountPaid, 0);
  const todayStr = todayISO();
  const todayRevenue = payments.filter((p) => p.date === todayStr).reduce((s, p) => s + p.amountPaid, 0);
  const totalPending = payments.reduce((s, p) => s + p.amountDue, 0);
  const paidCount = payments.filter((p) => p.status === "Paid").length;

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.patientName.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q) || (p.doctor && p.doctor.toLowerCase().includes(q));
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchMode = !filterMode || p.paymentMode === filterMode;
    return matchSearch && matchStatus && matchMode;
  });
  const filteredCollected = filtered.reduce((s, p) => s + p.amountPaid, 0);
  const filteredDue = filtered.reduce((s, p) => s + p.amountDue, 0);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <div className="text-center p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-zinc-600 font-medium">Connecting to system database architecture...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-zinc-900">

      {/* ── Collapsible Sidebar ── */}
      <aside className={`flex flex-col bg-white border-r border-zinc-200 shadow-sm transition-all duration-300 ${sidebarOpen ? "w-72" : "w-14"} shrink-0`}>
        <div className="flex items-center justify-between px-4 py-5 border-b border-zinc-100">
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Receptionist</p>
              <p className="text-sm font-black text-zinc-800 truncate">{user.fullName}</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            <svg className={`w-4 h-4 text-zinc-500 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {[
            { id: "queue",    label: "Queue",             icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", count: queue.length,             color: "sky"     },
            { id: "patients", label: "Patients",          icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", count: completedPatients.length, color: "emerald" },
          ].map(({ id, label, icon, count, color }) => (
            <button key={id} onClick={() => { setSidebarSection(id as "queue" | "patients"); if (!sidebarOpen) setSidebarOpen(true); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all ${
                sidebarSection === id && sidebarOpen
                  ? color === "sky" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
                  : "text-zinc-600 hover:bg-slate-100"
              }`}
              title={!sidebarOpen ? label : undefined}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{label}</span>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    color === "sky" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                  }`}>{count}</span>
                </>
              )}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="flex-1 border-t border-zinc-100 overflow-y-auto">
            {sidebarSection === "queue" && (
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 px-2 pt-2">
                  Live Queue · {queue.length} waiting
                </p>
                {queue.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic px-2 py-4 text-center">Queue is empty</p>
                ) : queue.map(item => (
                  <div key={item.id} className={`p-3 rounded-2xl border text-xs ${
                    item.isVip ? "border-amber-200 bg-amber-50/40" :
                    item.priority === "Critical" || item.priority === "High" ? "border-rose-200 bg-rose-50/30" :
                    "border-zinc-100 bg-slate-50"
                  }`}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        {item.token && (
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md mr-1 ${
                            item.isVip ? "bg-amber-500 text-white" :
                            item.tokenSession === "afternoon" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"
                          }`}>{item.token}</span>
                        )}
                        <p className="font-bold text-zinc-800 mt-1 truncate">{item.name}</p>
                        <p className="text-zinc-400">{item.age} y/o · {item.checkInTime}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarSection === "patients" && (
              <div className="p-3">
                <div className="flex items-center justify-between px-2 pt-2 mb-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                    Completed · {completedPatients.length}
                  </p>
                  {completedPatients.length > 0 && (
                    <button onClick={() => { if (confirm("Clear list?")) { setCompletedPatients([]); localStorage.removeItem("completedPatients"); } }}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold">Clear</button>
                  )}
                </div>
                {completedPatients.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic px-2 py-4 text-center">No completed patients yet</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-100">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          <th className="px-2 py-2 text-left font-extrabold uppercase tracking-wider text-zinc-400">Token</th>
                          <th className="px-2 py-2 text-left font-extrabold uppercase tracking-wider text-zinc-400">Patient</th>
                          <th className="px-2 py-2 text-left font-extrabold uppercase tracking-wider text-zinc-400">Doctor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {completedPatients.map(item => (
                          <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-2 py-2">
                              <span className="font-extrabold text-emerald-700">{item.token || "—"}</span>
                            </td>
                            <td className="px-2 py-2">
                              <p className="font-bold text-zinc-800 truncate max-w-[80px]">{item.name}</p>
                              <p className="text-zinc-400">{item.age}y · {item.gender}</p>
                              {item.patientId && <p className="text-zinc-300 font-mono">{item.patientId}</p>}
                            </td>
                            <td className="px-2 py-2">
                              <p className="text-zinc-600 truncate max-w-[70px]">{item.doctor || "—"}</p>
                              <p className="text-zinc-400 truncate max-w-[70px]">{item.department}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-3 border-t border-zinc-100">
          {/* Register Patient shortcut */}
          <button onClick={() => setActiveTab("register")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold mb-2 transition-all ${
              activeTab === "register" ? "bg-sky-50 text-sky-700" : "text-zinc-600 hover:bg-slate-100"
            }`}
            title={!sidebarOpen ? "Register Patient" : undefined}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {sidebarOpen && <span className="flex-1 text-left">Register Patient</span>}
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content structural wrapper ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navbar */}
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-8 py-4 shadow-sm">
          <div className="flex items-center gap-6 min-w-0">
            <div className="shrink-0">
              <h1 className="text-xl font-extrabold leading-tight">Receptionist Dashboard</h1>
              <p className="text-[11px] text-zinc-400 mt-0.5">Signed in as <span className="font-bold text-zinc-700">{user.fullName}</span></p>
            </div>
            {/* Stats pills */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {[
                { label: "In Queue",     value: queue.length,                                              bg: "bg-sky-50 border-sky-100 text-sky-700"       },
                { label: "Waiting",      value: queue.filter(q => q.status === "pending").length,           bg: "bg-amber-50 border-amber-100 text-amber-700"  },
                { label: "In Progress",  value: queue.filter(q => q.status === "treating").length,          bg: "bg-indigo-50 border-indigo-100 text-indigo-700"},
                { label: "Completed",    value: completedPatients.length,                                   bg: "bg-emerald-50 border-emerald-100 text-emerald-700"},
                { label: "Appointments", value: appointments.filter(a => a.status !== "cancelled").length,  bg: "bg-violet-50 border-violet-100 text-violet-700"},
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 ${s.bg}`}>
                  <span className="text-lg font-black leading-none">{s.value}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide opacity-75">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400">Today</p>
            <p className="text-sm font-bold text-zinc-600">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="bg-white border-b border-zinc-200 px-8">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "dashboard" ? "border-sky-600 text-sky-600" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
              </svg>
              Dashboard
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-zinc-600">{queue.length}</span>
            </button>
            <button onClick={() => setActiveTab("register")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "register" ? "border-sky-600 text-sky-600" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Register Patient
            </button>
            <button onClick={() => setActiveTab("appointments")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "appointments" ? "border-emerald-600 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Appointments
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-zinc-600">{appointments.filter(a => a.status !== "cancelled").length}</span>
            </button>
            <button onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "payments" ? "border-sky-600 text-sky-600" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Payments
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-zinc-600">{payments.length}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Tab Body Render Sections */}
        <div className="p-8 overflow-y-auto flex-1">
          {/* ── Dashboard Tab: Queue Only ── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Search & filter bar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={e => setQueueSearch(e.target.value)}
                    placeholder="Search by name, patient ID or address…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-sky-400 shadow-sm transition-all"
                  />
                  {queueSearch && (
                    <button onClick={() => setQueueSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {queueSearch && (
                  <p className="text-xs text-zinc-500 shrink-0">
                    {queue.filter(p => {
                      const q = queueSearch.toLowerCase();
                      return p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
                    }).length} result{queue.filter(p => {
                      const q = queueSearch.toLowerCase();
                      return p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
                    }).length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Queue table */}
              <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                  <div>
                    <h2 className="text-lg font-extrabold text-zinc-900">Live Patient Queue</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {queueSearch
                        ? `${queue.filter(p => { const q = queueSearch.toLowerCase(); return p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.address.toLowerCase().includes(q); }).length} of ${queue.length} patient${queue.length !== 1 ? "s" : ""} matched`
                        : `${queue.length} patient${queue.length !== 1 ? "s" : ""} waiting`}
                    </p>
                  </div>
                  <button onClick={() => setActiveTab("register")}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Register Patient
                  </button>
                </div>

                {(() => {
                  const filteredQueue = queueSearch
                    ? queue.filter(p => {
                        const q = queueSearch.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(q) ||
                          (p.patientId ?? "").toLowerCase().includes(q) ||
                          p.address.toLowerCase().includes(q)
                        );
                      })
                    : queue;
                  return queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm font-medium">No patients in queue</p>
                    <p className="text-xs mt-1">Register a patient to get started</p>
                  </div>
                ) : filteredQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                    <p className="text-sm font-medium">No results for "{queueSearch}"</p>
                    <p className="text-xs mt-1">Try searching by name, patient ID or address</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-100">
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Token</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Patient</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Contact</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Doctor</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Vitals</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Priority</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Status</th>
                          <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Time</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {filteredQueue.map((item) => {
                          const isUrgent = item.priority === "Critical" || item.priority === "High";
                          return (
                            <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${isUrgent ? "bg-rose-50/20" : ""}`}>
                              <td className="px-4 py-3">
                                {item.token ? (
                                  <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                                    item.isVip ? "bg-amber-500 text-white" :
                                    item.tokenSession === "afternoon" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"
                                  }`}>{item.token}</span>
                                ) : <span className="text-zinc-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-bold text-zinc-800">{item.name}</p>
                                  <p className="text-xs text-zinc-400">{item.age} y/o · {item.gender}</p>
                                  {item.patientId && <p className="text-[10px] text-zinc-300 font-mono">{item.patientId}</p>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-zinc-600">{item.phone}</p>
                                {item.address && <p className="text-[11px] text-zinc-400 truncate max-w-[140px]">{item.address}</p>}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-semibold text-zinc-700">{item.doctor || <span className="text-amber-500 font-semibold">Unassigned</span>}</p>
                                {item.department && <p className="text-[11px] text-zinc-400">{item.department}</p>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-[11px] text-zinc-500 space-y-0.5">
                                  {item.bloodPressure && <p>BP: {item.bloodPressure}</p>}
                                  {item.heartRate && <p>HR: {item.heartRate} bpm</p>}
                                  {item.temperature && <p>T: {item.temperature}°F</p>}
                                  {!item.bloodPressure && !item.heartRate && !item.temperature && <span className="text-zinc-300">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  item.priority === "Critical" ? "bg-rose-600 text-white" :
                                  item.priority === "High" ? "bg-orange-500 text-white" :
                                  item.priority === "Medium" ? "bg-amber-100 text-amber-700" :
                                  "bg-zinc-100 text-zinc-500"
                                }`}>{item.priority}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  item.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                  item.status === "treating" ? "bg-indigo-100 text-indigo-700" :
                                  "bg-amber-100 text-amber-700"
                                }`}>{item.status}</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{item.checkInTime}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => removeQueueItem(item.id)}
                                  className="rounded-lg border border-rose-200 text-rose-600 text-xs font-bold px-2.5 py-1 hover:bg-rose-50 transition-colors">
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
                })()}
              </div>
            </div>
          )}

          {/* ── Register Patient Tab ── */}
          {activeTab === "register" && (
            <div className="relative min-h-full -m-8 overflow-hidden">
              {/* Normal page background */}
{/* Gradient page background */}
<div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-sky-50 to-indigo-100 dark:from-zinc-800 dark:via-zinc-900 dark:to-slate-900" />

{/* Optional: Add a subtle blurred shape behind the card to make the glass "pop" */}
<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />              {/* Subtle noise texture overlay */}
              <div className="absolute inset-0 opacity-40"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23cbd5e1' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

              {/* Form card */}
              <div className="relative z-10 p-8">
                <div className="backdrop-blur-2xl bg-slate-800/15 border border-white/50 rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-slate-900/5">

                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-extrabold text-zinc-800">Register Patient</h2>
                      <p className="text-sm text-zinc-500 mt-0.5">Fill in patient details to add to the live queue</p>
                    </div>
                    {message && (
                      <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                        {message}
                      </div>
                    )}
                  </div>

                  {/* Appointment banner */}
                  {sourceAppointmentId && (
                    <div className="mb-5 rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-700 text-lg">📋</span>
                        <div>
                          <p className="text-xs font-extrabold text-sky-700">Pre-filled from Appointment</p>
                          <p className="text-xs text-sky-500 mt-0.5">Fill in age, address and vitals then submit</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => { setSourceAppointmentId(null); setName(""); setPhone(""); setDoctorId(""); setDoctor(""); setDepartment(""); setReason(""); }}
                        className="text-xs text-zinc-400 hover:text-zinc-800 shrink-0">✕</button>
                    </div>
                  )}

                  <form onSubmit={handleAddToQueue} className="space-y-4">

                    {/* Row 1: Name · Age · Gender · Phone */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Full Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-xl bg-white/90 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:bg-white/80 transition-all"
                          placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Age</label>
                        <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="45" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Gender</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all">
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Phone</label>
                        <div className="relative">
                          <input type="text" value={phone} onChange={(e) => {
                            setPhone(formatPhone("+1", e.target.value));
                            setPhoneDropdownOpen(true);
                          }}
                            onFocus={() => setPhoneDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setPhoneDropdownOpen(false), 150)}
                            className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                            placeholder="555-012-3456" autoComplete="off" />
                          {phoneDropdownOpen && phone.replace(/\D/g, "").length >= 3 && (() => {
                            const digits = phone.replace(/\D/g, "");
                            const matches = queue.filter(q => q.phone.replace(/\D/g, "").includes(digits));
                            if (matches.length === 0) return null;
                            return (
                              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
                                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Returning patient{matches.length > 1 ? "s" : ""} — click to autofill</p>
                                </div>
                                {matches.slice(0, 4).map((q) => (
                                  <button key={q.id} type="button"
                                    onMouseDown={() => { setPhone(q.phone); setName(q.name); setAge(String(q.age)); setGender(q.gender); setAddress(q.address); setPhoneDropdownOpen(false); }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-zinc-100 last:border-0 transition-colors">
                                    <p className="text-sm font-bold text-zinc-800">{q.name}</p>
                                    <p className="text-xs text-zinc-400">{q.phone} · {q.age} y/o · {q.gender}</p>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Address</label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="Street, city" />
                      </div>
                    </div>

                    {/* Row 2: Visit type · Revisit picker */}
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { val: "new",      label: "New Patient",  icon: "👤" },
                        { val: "revisit",  label: "Revisit",      icon: "🔁" },
                        { val: "followup", label: "Follow-up",    icon: "📋" },
                      ] as const).map(({ val, label, icon }) => (
                        <button key={val} type="button"
                          onClick={() => { setVisitType(val); setRevisitPatientId(""); }}
                          className={`py-2 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                            visitType === val
                              ? "bg-sky-600 text-white border-sky-600 shadow-md"
                              : "bg-white/60 border-zinc-200 text-zinc-600 hover:bg-white/80"
                          }`}
                        >{icon} {label}</button>
                      ))}
                    </div>

                    {/* Revisit patient picker */}
                    {(visitType === "revisit" || visitType === "followup") && (() => {
                      const today = new Date().toISOString().split("T")[0];
                      const candidates = queue.filter(q => q.followUp);
                      if (candidates.length === 0) return (
                        <p className="text-xs text-zinc-400 italic">No patients with a scheduled follow-up in queue.</p>
                      );
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {candidates.map(p => {
                            const isEarly = p.followUp! > today;
                            const selected = revisitPatientId === p.id;
                            return (
                              <button key={p.id} type="button"
                                onClick={() => { setRevisitPatientId(p.id); setName(p.name); setAge(String(p.age)); setPhone(p.phone); setAddress(p.address); setGender(p.gender); if (p.doctorId) setDoctorId(p.doctorId); if (p.doctor) setDoctor(p.doctor); if (p.department) setDepartment(p.department); }}
                                className={`text-left p-3 rounded-xl border text-xs transition-all ${selected ? "border-white bg-sky-50 text-zinc-800" : "border-zinc-200 bg-white/60 text-zinc-600 hover:bg-white/80"}`}
                              >
                                <p className="font-bold">{p.name}</p>
                                <p className="text-zinc-400">{p.phone} · {p.age} y/o</p>
                                {isEarly && <p className="text-amber-600 font-semibold mt-1">⚡ Early visit</p>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Row 3: Doctor · Reason · Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Assign Doctor (optional)</label>
                        <select value={doctorId} onChange={(e) => handleDoctorChange(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all">
                          <option value="">Unassigned — triage first</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>Dr. {d.name} ({d.department})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Reason for Visit</label>
                        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="Symptoms, checkup, etc..." />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Triage Priority</label>
                        <div className="grid grid-cols-4 gap-1">
                          {["Low","Medium","High","Critical"].map(p => (
                            <button key={p} type="button" onClick={() => setPriority(p)}
                              className={`py-2 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                                priority === p
                                  ? p === "Critical" ? "bg-rose-500 text-zinc-800 shadow-md"
                                    : p === "High" ? "bg-orange-500 text-zinc-800 shadow-md"
                                    : p === "Medium" ? "bg-amber-400 text-zinc-800 shadow-md"
                                    : "bg-white text-zinc-700 shadow-md"
                                  : "bg-white/60 border border-zinc-200 text-zinc-400 hover:bg-white/80"
                              }`}
                            >{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Vitals */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Blood Pressure</label>
                        <input type="text" value={bp} onChange={(e) => setBp(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="120/80" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Pulse (bpm)</label>
                        <input type="text" value={pulse} onChange={(e) => setPulse(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="72" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">Temperature (°F)</label>
                        <input type="text" value={temperature} onChange={(e) => setTemperature(e.target.value)}
                          className="w-full rounded-xl bg-white/60 border border-zinc-200 text-zinc-800 placeholder-zinc-400 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-all"
                          placeholder="98.6" />
                      </div>
                    </div>

                    {/* Row 5: VIP toggle + Submit */}
                    <div className="flex items-center gap-4 pt-1">
                      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${isVip ? "bg-amber-500/20 border-amber-400/40" : "bg-white/60 border-zinc-200"}`}
                        onClick={() => { setIsVip(v => !v); setRequestedVipToken(""); }}>
                        <button type="button" className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isVip ? "bg-amber-500" : "bg-sky-50"}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isVip ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                        <span className={`text-xs font-bold ${isVip ? "text-amber-200" : "text-zinc-500"}`}>VIP Patient</span>
                      </div>
                      {isVip && (
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button"
                              onClick={() => setRequestedVipToken(requestedVipToken === n ? "" : n)}
                              className={`w-10 h-9 rounded-lg text-xs font-extrabold border transition-all ${requestedVipToken === n ? "bg-amber-500 border-amber-500 text-zinc-800" : "bg-white/60 border-zinc-200 text-zinc-500 hover:bg-amber-500/20"}`}
                            >T00{n}</button>
                          ))}
                        </div>
                      )}
                      <button type="submit"
                        className={`ml-auto px-8 py-2.5 rounded-xl text-sm font-extrabold text-zinc-800 transition-all shadow-lg ${
                          isVip ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25" : "bg-sky-50 hover:bg-white/30 border border-zinc-300"
                        }`}>
                        {isVip ? "Register VIP Patient" : "Check In to Queue"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm p-6">
              <h2 className="text-xl font-extrabold text-zinc-900 mb-2">Booked Appointments Catalog</h2>
              <p className="text-xs text-zinc-500 mb-6">Process client arrivals instantly below into live active queue tokens.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-bold bg-zinc-50/70">
                      <th className="p-3">Patient</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Doctor / Department</th>
                      <th className="p-3">Schedule Slot</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appt) => (
                      <tr key={appt.id} className="border-b border-zinc-100 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-zinc-800">{appt.patientName}</td>
                        <td className="p-3 text-zinc-600">{appt.patientPhone}</td>
                        <td className="p-3">
                          <p className="font-medium">Dr. {appt.doctorName}</p>
                          <p className="text-xs text-zinc-400">{appt.department}</p>
                        </td>
                        <td className="p-3 text-zinc-600">{appt.date} ({appt.timeSlot})</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${appt.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : appt.status === "cancelled" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                            {appt.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {appt.status !== "confirmed" && appt.status !== "cancelled" ? (
                            <button onClick={() => checkInFromAppointment(appt)} className="rounded-xl bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 hover:bg-emerald-700 transition-colors">
                              Check In Arrival
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-6">
              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Today's Revenue Collected</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{fmtCurrency(todayRevenue)}</p>
                </div>
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total System Revenue</p>
                  <p className="text-2xl font-black text-zinc-800 mt-1">{fmtCurrency(totalCollected)}</p>
                </div>
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Outstanding Receivables</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">{fmtCurrency(totalPending)}</p>
                </div>
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Paid Invoices Ledger Count</p>
                  <p className="text-2xl font-black text-sky-600 mt-1">{paidCount} Records</p>
                </div>
              </div>

              <div className="grid gap-8 xl:grid-cols-[1fr_1.8fr]">
                {/* Record Invoice Form */}
                <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6 h-fit">
                  <h3 className="text-lg font-extrabold text-zinc-900 mb-4">Record New Invoice Payment</h3>
                  
                  {payMessage && (
                    <div className={`p-3 rounded-xl text-xs font-bold mb-4 ${payMessageType === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                      {payMessage}
                    </div>
                  )}

                  <form onSubmit={handleSavePayment} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Patient Name</label>
                      <input type="text" value={fPatientName} onChange={(e) => setFPatientName(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" placeholder="Johnathan Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 mb-1">Bill Amount (₹)</label>
                        <input type="number" value={fTotalAmount} onChange={(e) => setFTotalAmount(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" placeholder="1500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 mb-1">Amount Paid (₹)</label>
                        <input type="number" value={fAmountPaid} onChange={(e) => setFAmountPaid(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" placeholder="1500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Service Provided</label>
                      <select value={fService} onChange={(e) => setFService(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5 bg-white">
                        {SERVICE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 mb-1">Doctor Reference</label>
                        <select value={fDoctorId} onChange={(e) => handlePayDoctorChange(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5 bg-white">
                          <option value="">Select Doctor</option>
                          {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 mb-1">Payment Mode</label>
                        <select value={fPaymentMode} onChange={(e) => setFPaymentMode(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5 bg-white">
                          {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Transaction Ref / Cheque No.</label>
                      <input type="text" value={fReferenceNo} onChange={(e) => setFReferenceNo(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" placeholder="TXN98724125" />
                    </div>
                    <button type="submit" className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors">
                      Process Ledger Transaction
                    </button>
                  </form>
                </section>

                {/* Receipts Transaction Log */}
                <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-zinc-200 flex items-center justify-between gap-4 bg-zinc-50/50">
                    <h3 className="text-sm font-extrabold text-zinc-800">Historical Invoices Ledger Logs</h3>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="text-xs rounded-xl border border-zinc-300 p-2 w-48 bg-white" placeholder="Search logs..." />
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic p-6">No historical records matched your current query criteria layout.</p>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500 font-bold bg-slate-50">
                            <th className="p-3">Patient</th>
                            <th className="p-3">Service Details</th>
                            <th className="p-3">Total Invoice</th>
                            <th className="p-3">Collected</th>
                            <th className="p-3">Due Bal</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Operations</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((p) => (
                            <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                              <td className="p-3 font-bold text-zinc-800">{p.patientName}</td>
                              <td className="p-3 text-zinc-600">{p.service}</td>
                              <td className="p-3 font-medium">{fmtCurrency(p.totalAmount)}</td>
                              <td className="p-3 font-bold text-emerald-600">{fmtCurrency(p.amountPaid)}</td>
                              <td className="p-3 font-bold text-amber-600">{fmtCurrency(p.amountDue)}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 font-bold rounded-full text-[10px] ${STATUS_STYLES[p.status] || "bg-zinc-100 text-zinc-700"}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button onClick={() => handleDeletePayment(p.id)} className="text-rose-600 font-bold hover:underline">
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}