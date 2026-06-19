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

// FIX #1 — Moved interfaces outside the component
interface RevisitSuggestion {
  followUp: string;
  diagnosis: string;
  doctor: string;
  visitType: string;
}

interface PatientCard {
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  doctorId: string;
  doctor: string;
  department: string;
  lastDiagnosis: string;
  lastReason: string;
  patientId: string;
  followUp: string;
  scheduledVisitType: string;
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
  if (paid >= total) return "Paid";//check if fully paid first
  if (paid <= 0) return "Pending";
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

  // ── Revisit search state ──
  const [revisitSearch, setRevisitSearch] = useState({ name: "", phone: "", address: "" });
  const [revisitResults, setRevisitResults] = useState<PatientCard[]>([]);
  const [revisitSearchLoading, setRevisitSearchLoading] = useState(false);
  const [selectedRevisitPatient, setSelectedRevisitPatient] = useState<PatientCard | null>(null);

  // ── Revisit suggestion state ──
  const [revisitSuggestion, setRevisitSuggestion] = useState<RevisitSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [patientCard, setPatientCard] = useState<PatientCard | null>(null);

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

    // FIX #7 — warn on corrupted localStorage instead of silent catch
    try {
      const storedCompleted = localStorage.getItem("completedPatients");
      if (storedCompleted) {
        setCompletedPatients(JSON.parse(storedCompleted));
      }
    } catch (err) {
      console.warn("Corrupted completedPatients in localStorage, clearing.", err);
      localStorage.removeItem("completedPatients");
    }
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
    const pollInterval = setInterval(loadQueue, 30000);
    return () => clearInterval(pollInterval);
  }, [mounted]);
  // ── Unified Real-Time Patient Status Lookup ──
  useEffect(() => {
  if (visitType === "new" || (!phone.trim() && !name.trim())) {
    setRevisitResults([]);
    return;
  }

  const delayDebounceFn = setTimeout(async () => {
    setRevisitSearchLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const searchParam = phone.trim() 
        ? `phone=${encodeURIComponent(phone.trim())}` 
        : `name=${encodeURIComponent(name.trim())}`;

      const response = await fetch(`${API_BASE_URL}/api/patients/search?${searchParam}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const patientsRaw = Array.isArray(data) ? data : data.patients || [];
        
        // Map the backend structure to match the PatientCard layout expected by your UI
        const mappedResults: PatientCard[] = patientsRaw.map((p: any) => ({
          name:               p.name,
          age:                p.age,
          gender:             p.gender,
          phone:              p.phone,
          address:            p.address,
          doctorId:           p.doctorId || "",
          doctor:             p.doctor || "",
          department:         p.department || "",
          lastDiagnosis:      p.lastDiagnosis || "",
          lastReason:         p.reason || "",
          patientId:          p.patientId || p.id, // Handles cross-compatible IDs
          followUp:           p.followUp || "",
          scheduledVisitType: p.scheduledVisitType || visitType,
        }));

        setRevisitResults(mappedResults);
      }
    } catch (error) {
      console.error("Live lookup pipeline exception:", error);
    } finally {
      setRevisitSearchLoading(false);
    }
  }, 350);

  return () => clearTimeout(delayDebounceFn);
}, [phone, name, visitType, selectedRevisitPatient]);

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

  // ── Look up revisit suggestion by phone number ──
  async function checkRevisitByPhone(phoneValue: string) {
  const digits = phoneValue.replace(/\D/g, "");
  
  // Wait until a full phone number is typed (usually 10 digits in IN/US) to prevent spamming the API
  if (digits.length < 10) { 
    setRevisitSuggestion(null); 
    setPatientCard(null); 
    return; 
  }

  const token = localStorage.getItem("accessToken");
  if (!token) return;

  try {
    // 1. Fetch directly from the backend using the phone number
    const res = await fetch(
      `${API_BASE_URL}/api/patients/history/${encodeURIComponent(phoneValue)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!res.ok) { 
      setRevisitSuggestion(null); 
      setPatientCard(null); 
      return; 
    }
    
    const data = await res.json();
    
    // If no patient found in DB, exit
    if (!data.patient) {
      setRevisitSuggestion(null); 
      setPatientCard(null); 
      return; 
    }

    const dbPatient = data.patient;

    // 2. Populate the PatientCard using the database response instead of the local match
    const card: PatientCard = {
      name: dbPatient.name,
      age: dbPatient.age,
      gender: dbPatient.gender,
      phone: dbPatient.phone,
      address: dbPatient.address,
      doctorId: dbPatient.doctorId || "",
      doctor: dbPatient.doctor || "",
      department: dbPatient.department || "",
      lastDiagnosis: data.history?.[0]?.diagnosis || "",
      lastReason: dbPatient.reason || "",
      patientId: dbPatient.id || "",
      followUp: data.history?.find((h: any) => h.followUp)?.followUp || "",
      scheduledVisitType: data.history?.find((h: any) => h.followUp)?.visitType || "revisit",
    };
    
    setPatientCard(card);

    // 3. Auto-fill the UI state
    setName(dbPatient.name);
    setAge(String(dbPatient.age));
    setGender(dbPatient.gender);
    setPhone(dbPatient.phone);
    setAddress(dbPatient.address);
    if (dbPatient.doctorId) setDoctorId(dbPatient.doctorId);
    if (dbPatient.doctor) setDoctor(dbPatient.doctor);
    if (dbPatient.department) setDepartment(dbPatient.department);

    // 4. Handle follow-up suggestions
    const withFollowUp = (data.history || []).find((h: any) => h.followUp);
    if (withFollowUp) {
      setRevisitSuggestion({
        followUp: withFollowUp.followUp,
        diagnosis: withFollowUp.diagnosis || "",
        doctor: withFollowUp.doctor || "",
        visitType: withFollowUp.visitType || "revisit",
      });
      setSuggestionDismissed(false);
    } else {
      setRevisitSuggestion(null);
    }
  } catch (error) {
    console.error("Failed to fetch revisit data:", error);
    setRevisitSuggestion(null);
    setPatientCard(null);
  }
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
    setActiveTab("register");
    setMessage(`✓ Appointment loaded — please fill in vitals and address for ${appt.patientName}`);
    setTimeout(() => setMessage(""), 5000);
  }

  // ── Search existing patients for revisit/followup ──
  async function searchRevisitPatients() {
    const { name: sName, phone: sPhone, address: sAddr } = revisitSearch;
    if (!sName.trim() && !sPhone.trim() && !sAddr.trim()) {
      setRevisitResults([]);
      return;
    }
    setRevisitSearchLoading(true);
    setSelectedRevisitPatient(null);
    const token = localStorage.getItem("accessToken");
    if (!token) { setRevisitSearchLoading(false); return; }
    try {
      const params = new URLSearchParams();
      if (sName.trim())  params.append("name",    sName.trim());
      if (sPhone.trim()) params.append("phone",   sPhone.trim());
      if (sAddr.trim())  params.append("address", sAddr.trim());

      const res = await fetch(`${API_BASE_URL}/api/patients/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setRevisitResults([]); return; }
      const data = await res.json();

      const results: PatientCard[] = (data.patients || []).map((p: QueueItem & { lastDiagnosis?: string; lastReason?: string; scheduledVisitType?: string }) => ({
        name:               p.name,
        age:                p.age,
        gender:             p.gender,
        phone:              p.phone,
        address:            p.address,
        doctorId:           p.doctorId || "",
        doctor:             p.doctor || "",
        department:         p.department || "",
        lastDiagnosis:      p.lastDiagnosis || "",
        lastReason:         p.reason || "",
        patientId:          p.patientId || p.id,
        followUp:           p.followUp || "",
        scheduledVisitType: p.scheduledVisitType || visitType,
      }));
      setRevisitResults(results);
    } catch {
      setRevisitResults([]);
    } finally {
      setRevisitSearchLoading(false);
    }
  }

  function selectRevisitPatient(p: PatientCard) {
  setSelectedRevisitPatient(p);
  setName(p.name);
  setAge(String(p.age));
  setGender(p.gender);
  setPhone(p.phone);
  setAddress(p.address);
  setRevisitPatientId(p.patientId);
  setPatientCard(p);
  setReason(p.lastReason || "Follow-up visit");

  // Keep the previous doctor and department assigned to them
  setDoctorId(p.doctorId);
  setDoctor(p.doctor);
  setDepartment(p.department);

  // ── AUTOMATIC STATUS FILTER LOGIC ──
  if (p.followUp) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUpDate = new Date(p.followUp);
    followUpDate.setHours(0, 0, 0, 0);

    if (today > followUpDate) {
      // Patient missed their due date, automatically tag as a "revisit"
      setVisitType("revisit");
      setMessage(`⚠️ Revisit: Patient was scheduled for ${p.followUp} (Overdue)`);
    } else {
      // Patient came on time or early
      setVisitType("followup");
      setMessage(`📅 Scheduled Follow-up active for ${p.followUp}`);
    }
  } else {
    // No explicit follow up date found, default back to regular revisit
    setVisitType("revisit");
  }

  // Clear notification message after 5 seconds
  setTimeout(() => setMessage(""), 5000);
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

  // FIX #6 — kept for display use; remove if not rendering them
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
            { id: "queue",    label: "Queue",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", count: queue.length,             color: "sky"     },
            { id: "patients", label: "Patients", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", count: completedPatients.length, color: "emerald" },
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
                    (item.visitType === "followup" || item.visitType === "revisit") ? "border-orange-200 bg-orange-50/30" :
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
                        {(item.visitType === "revisit" || item.visitType === "followup") && (
                          <span className={`inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                            item.visitType === "followup" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                          }`}>{item.visitType === "followup" ? "📋 Follow-up" : "🔁 Revisit"}</span>
                        )}
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
                              {(item.visitType === "revisit" || item.visitType === "followup") && (
                                <span className={`inline-block mt-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                  item.visitType === "followup" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                                }`}>{item.visitType === "followup" ? "Follow-up" : "Revisit"}</span>
                              )}
                              {item.followUp && (
                                <p className="text-[9px] text-orange-500 font-semibold mt-0.5">
                                  Due: {new Date(item.followUp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>
                              )}
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
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
              {[
                { label: "In Queue",     value: queue.length,                                              bg: "bg-sky-50 border-sky-100 text-sky-700"        },
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

        {/* ─────────────── TAB BODIES ─────────────── */}
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
                                  {(item.visitType === "revisit" || item.visitType === "followup") && (
                                    <span className={`inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                      item.visitType === "followup"
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-orange-100 text-orange-700"
                                    }`}>
                                      {item.visitType === "followup" ? "📋 Follow-up" : "🔁 Revisit"}
                                    </span>
                                  )}
                                  {item.followUp && (
                                    <p className="text-[10px] text-orange-500 font-semibold mt-0.5">
                                      Due: {new Date(item.followUp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                  )}
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
          {/* ── Register Patient Tab ── */}
        {activeTab === "register" && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim() || !phone.trim() || !age || !address.trim() || !reason.trim()) {
                    setMessage("⚠️ Please complete all required configuration targets.");
                    return;
                  }
                  const token = localStorage.getItem("accessToken");
                  if (!token) return;

                  const payload = {
                    name: name.trim(),
                    age: parseInt(age) || 0,
                    gender,
                    phone: phone.trim(),
                    address: address.trim(),
                    doctor,
                    doctorId,
                    department,
                    reason: reason.trim(),
                    priority,
                    isVip,
                    requestedVipToken: requestedVipToken || undefined,
                    visitType,
                    patientId: visitType !== "new" ? revisitPatientId : undefined,
                    appointmentId: sourceAppointmentId || undefined,
                    bloodPressure: bp || undefined,
                    heartRate: pulse || undefined,
                    temperature: temperature || undefined
                  };

                  try {
                    const response = await fetch(`${API_BASE_URL}/api/patients`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload),
                    });
                    if (response.ok) {
                      const data = await response.json();
                      setQueue((current) => [...current, data.patient]);
                      
                      // Reset layout states
                      setName(""); setAge(""); setGender("Male"); setPhone(""); setAddress("");
                      setDoctorId(""); setDoctor(""); setDepartment(""); setReason(""); setPriority("Low");
                      setBp(""); setPulse(""); setTemperature(""); setIsVip(false); setRequestedVipToken("");
                      setVisitType("new"); setRevisitPatientId(""); setSourceAppointmentId(null); setSelectedRevisitPatient(null);
                      setMessage("✅ Patient successfully checked into live monitoring stream.");
                      setTimeout(() => setMessage(""), 5000);
                    } else {
                      const errorData = await response.json().catch(() => ({}));
                      setMessage(`❌ Check-in rejection: ${errorData.message || response.statusText}`);
                    }
                  } catch (error) {
                    console.error("Form submittal exception:", error);
                    setMessage("❌ Network configuration pipeline failure.");
                  }
                }} 
                className="space-y-4"
              >
                
                {/* Visit Type Selector Header */}
                <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-zinc-100">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Visit Configuration Status
                    </label>
                    <select
  value={visitType}
  onChange={(e) => {
    const nextType = e.target.value as "new" | "revisit";
    setVisitType(nextType);
    
    // FIX: Verify a valid phone layout length exists. Prevents routing 
    // alphabetical names down phone-specific API query chains.
    if (nextType !== "new" && phone.trim().length >= 10) {
      checkRevisitByPhone(phone.trim());
    }
  }}
  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
>
  <option value="new">New Registration</option>
  <option value="revisit">Revisit / Follow-up</option>
</select>
                  </div>
                  {message && (
                    <div className="ml-auto px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-100">
                      {message}
                    </div>
                  )}
                </div>

                {/* Core Patient Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Phone Input */}
                  {/* Phone Input */}
<div>
  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Phone *</label>
  <input
    type="text" required
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
    className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
    placeholder="10-digit number"
  />
</div>

{/* Name Input */}
<div className="md:col-span-2">
  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Patient Full Name *</label>
  <input
    type="text" required
    value={name}
    onChange={(e) => setName(e.target.value)}
    className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
    placeholder="Enter first & last name"
  />
</div>

                  {/* Age Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Age *</label>
                    <input
                      type="number" required
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Age"
                    />
                  </div>

                  {/* Gender Selector */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Address Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Address *</label>
                    <input
                      type="text" required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="City/Street location"
                    />
                  </div>
                </div>

                {/* ── INLINE SMART SUGGESTIONS & STATUS DETECTOR ── */}
                {visitType !== "new" && (phone.trim() || name.trim()) && (
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-dashed border-zinc-300 space-y-2 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                        Real-Time Patient Status Lookup
                      </h4>
                      {revisitSearchLoading && (
                        <span className="text-[10px] text-sky-600 animate-pulse font-medium">Scanning record vault...</span>
                      )}
                    </div>

                    {/* Case 1: Match Found */}
                    {revisitResults.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {revisitResults.map((p) => {
                          const isSelected = selectedRevisitPatient?.patientId === p.patientId;
                          return (
                            <div
                              key={p.patientId}
                              onClick={() => {
                                selectRevisitPatient(p);
                                // Automatically sync main form inputs on click
                                setName(p.name);
                                setPhone(p.phone);
                                setAge(p.age?.toString() || "");
                                setGender(p.gender || "Male");
                                setAddress(p.address || "");
                              }}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? "border-sky-500 bg-sky-50 text-sky-900 shadow-sm"
                                  : "border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              <div className="flex justify-between items-start font-bold">
                                <span>{p.name} ({p.age}y/{p.gender})</span>
                                {p.followUp ? (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                    🗓️ Revisit Scheduled: {p.followUp}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                    No Revisit Scheduled
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-1">📞 {p.phone} | 📍 {p.address || "No Address"}</p>
                              {isSelected && (
                                <p className="text-[10px] font-semibold text-sky-600 mt-1.5 flex items-center gap-1">
                                  ✓ Patient linked to registration queue payload
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Case 2: No Match Found in Database */}
                    {!revisitSearchLoading && revisitResults.length === 0 && (
                      <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                        <span>⚠️ No patient registered with these parameters in historical vaults.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Assignment & Management Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Doctor Assignment Dropdown */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Assign Doctor</label>
                    <select
                      value={doctorId}
                      onChange={(e) => handleDoctorChange(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="">Unassigned — triage first</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>Dr. {d.name} ({d.department})</option>
                      ))}
                    </select>
                  </div>

                  {/* Reason Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Reason for Visit *</label>
                    <input
                      type="text" required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Symptoms or consultation type"
                    />
                  </div>

                  {/* Priority Selector */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1">Queue Priority *</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 text-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Critical">Critical Emergency</option>
                    </select>
                  </div>
                </div>

                {/* Vitals Assessment Sub-panel */}
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-2 mt-2">
                  <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">Patient Vital Signs Triage (Optional)</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Blood Pressure</label>
                      <input
                        type="text" value={bp} onChange={(e) => setBp(e.target.value)}
                        placeholder="120/80 mmHg" className="w-full text-xs p-2 rounded-xl border border-zinc-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Pulse / Heart Rate</label>
                      <input
                        type="text" value={pulse} onChange={(e) => setPulse(e.target.value)}
                        placeholder="72 bpm" className="w-full text-xs p-2 rounded-xl border border-zinc-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 mb-0.5">Body Temp</label>
                      <input
                        type="text" value={temperature} onChange={(e) => setTemperature(e.target.value)}
                        placeholder="98.6 °F" className="w-full text-xs p-2 rounded-xl border border-zinc-200 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Actions: VIP and Check-In Submit */}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-4 mt-2">
                  <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setIsVip(!isVip); setRequestedVipToken(""); }}>
                    <button type="button" className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isVip ? "bg-amber-500" : "bg-zinc-200"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isVip ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <span className={`text-xs font-bold ${isVip ? "text-amber-600" : "text-zinc-500"}`}>VIP Priority Token Block</span>
                  </div>

                  {isVip && (
                    <div className="flex gap-1 items-center">
                      <span className="text-[10px] font-bold text-zinc-400 mr-1">Slot:</span>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" onClick={() => setRequestedVipToken(requestedVipToken === n ? "" : n)}
                          className={`w-10 h-8 rounded-lg text-xs font-extrabold border transition-all ${requestedVipToken === n ? "bg-amber-500 border-amber-500 text-zinc-950" : "bg-white border-zinc-200 text-zinc-500 hover:bg-amber-50"}`}
                        >
                          T00{n}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-wide uppercase shadow-sm transition-all ${
                      isVip 
                        ? "bg-amber-500 hover:bg-amber-600 text-zinc-950" 
                        : "bg-sky-600 hover:bg-sky-700 text-white"
                    }`}
                  >
                    {isVip ? "Register VIP Check-In" : "Check In to Live Queue"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

          {/* ── Appointments Tab ── */}
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

          {/* ── Payments Tab ── */}
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

                    {/* FIX #4 — Patient ID field added */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Patient ID (optional)</label>
                      <input type="text" value={fPatientId} onChange={(e) => setFPatientId(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" placeholder="e.g. P-00123" />
                    </div>

                    {/* FIX #2 — Bill Date field added */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Bill Date</label>
                      <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5" />
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

                    {/* FIX #5 — Notes field added */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Notes (optional)</label>
                      <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} className="w-full text-xs rounded-xl border border-zinc-300 p-2.5 resize-none" rows={2} placeholder="Any additional remarks..." />
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

                  {/* FIX #6 — filteredCollected and filteredDue displayed here */}
                  <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex gap-4 text-xs text-zinc-500">
                    Filtered: Collected <span className="font-bold text-emerald-600 ml-1">{fmtCurrency(filteredCollected)}</span>
                    <span className="mx-1">·</span>
                    Due <span className="font-bold text-amber-600 ml-1">{fmtCurrency(filteredDue)}</span>
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