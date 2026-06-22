"use client";

import { useEffect, useState, useRef } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Patient {
  id: string;
  historyLoaded?: boolean;  // add this line
  patientId?: string;
  queueId?: string;
  name: string;
  age: number;
  gender: string;
  phone?: string;
  address?: string;
  doctor?: string;
  department?: string;
  visitCount?: number;
  time: string;
  status: "pending" | "treating" | "completed";
  visitType?: "new" | "revisit" | "followup";
  priority?: string;
  reason: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    spO2?: number;
    respiratoryRate?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    iop?: string;
    peakFlow?: number;
    bloodGlucose?: number;
    painScore?: number;
  };
  symptoms: string;
  chiefComplaint: string;
  primaryDiagnosis: string;
  notes: string;
  followUp?: string;
  tests: string[];
  medications: Array<{ name: string; dosage: string; frequency: string; days: string; remarks?: string }>;
  allergies?: string[];
  pastVisits?: Array<{
    date: string;
    diagnosis: string;
    medications: string[];
    tests: string[];
    notes: string;
    visitType?: string;
    chiefComplaint?: string;
    symptoms?: string;
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    doctor?: string;
    patientId?: string;
  }>;
}

interface DoctorOption {
  id: string;
  name: string;
  department: string | null;
}

interface QueueItem {
  id: string;
  queueId?: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  doctor: string;
  department: string;
  reason: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  checkInTime: string;
  status: string;
  priority: string;
  visitType?: "new" | "revisit" | "followup";
}

const DASHBOARD_STORAGE_VERSION = "2";
const DASHBOARD_STORAGE_VERSION_KEY = "dashboardStorageVersion";

const dosageDefaults = [
  "5mg", "10mg", "25mg", "50mg", "100mg", "250mg", "500mg", "650mg", "1g",
  "1 tablet", "2 tablets", "1 capsule", "5ml", "10ml", "15ml",
  "1 puff", "2 puffs", "1 drop", "2 drops", "Apply thin layer"
];

const dosageMap: Record<string, string[]> = {
  Paracetamol: ["500mg", "650mg", "1g", "5ml", "10ml", "15ml"],
  Ibuprofen: ["200mg", "400mg", "600mg", "800mg"],
  Aspirin: ["81mg", "150mg", "325mg", "500mg"],
  Clopidogrel: ["75mg", "150mg", "300mg"],
  Atorvastatin: ["5mg", "10mg", "20mg", "40mg", "80mg"],
  Rosuvastatin: ["5mg", "10mg", "20mg", "40mg", "80mg"],
  Metoprolol: ["25mg", "50mg", "100mg", "200mg"],
  Atenolol: ["25mg", "50mg", "100mg"],
  Amlodipine: ["2.5mg", "5mg", "10mg"],
  Losartan: ["25mg", "50mg", "100mg"],
  Lisinopril: ["2.5mg", "5mg", "10mg", "20mg"],
  Ramipril: ["2.5mg", "5mg", "10mg", "20mg"],
  Furosemide: ["20mg", "40mg", "80mg"],
  Spironolactone: ["25mg", "50mg", "100mg"],
  Amoxicillin: ["250mg", "500mg", "875mg"],
  Azithromycin: ["250mg", "500mg"],
  Ciprofloxacin: ["250mg", "500mg", "750mg"],
  Doxycycline: ["100mg"],
  Metronidazole: ["250mg", "400mg", "500mg"],
  Omeprazole: ["20mg", "40mg"],
  Pantoprazole: ["20mg", "40mg"],
  Esomeprazole: ["20mg", "40mg"],
  Rabeprazole: ["20mg", "40mg"],
  Domperidone: ["10mg", "30mg"],
  Ondansetron: ["4mg", "8mg"],
  Cetirizine: ["5mg", "10mg"],
  Loratadine: ["10mg"],
  Prednisolone: ["5mg", "10mg", "20mg", "40mg"],
  Dexamethasone: ["0.5mg", "1mg", "2mg", "4mg", "8mg"],
  Metformin: ["500mg", "850mg", "1000mg"],
  Gabapentin: ["100mg", "300mg", "400mg", "600mg", "800mg"],
  Pregabalin: ["50mg", "75mg", "150mg", "300mg"],
  Levetiracetam: ["250mg", "500mg", "750mg", "1000mg"],
  Clonazepam: ["0.25mg", "0.5mg", "1mg", "2mg"],
  Alprazolam: ["0.25mg", "0.5mg", "1mg", "2mg"],
};

const queueItemToPatient = (item: QueueItem, existingPatients: Patient[]): Patient => {
  const prevVisits = existingPatients
    .filter(p => p.name.toLowerCase() === item.name.toLowerCase() && p.status === "completed" && p.id !== `PT-${item.id.replace(/\D/g, "")}`)
    .slice(0, 5)
    .map(p => ({
      date: p.time,
      diagnosis: p.primaryDiagnosis || "",
      medications: p.medications.map(m => `${m.name} ${m.dosage}`),
      tests: p.tests || [],
      notes: p.notes || "",
      visitType: p.visitType,
    }));

  const allergyKeywords = ["allergy", "allergic", "anaphylaxis", "intolerance", "hypersensitivity", "rash", "urticaria", "penicillin", "sulfa", "nsaid"];
// AFTER — also match phone to avoid cross-patient allergy bleed
const allNotes = existingPatients
  .filter(p =>
    p.name.toLowerCase() === item.name.toLowerCase() &&
    (!item.phone || !p.phone || p.phone === item.phone)
  )
  .map(p => (p.notes + " " + p.symptoms + " " + p.chiefComplaint).toLowerCase())
  .join(" ");
  const detectedAllergies = allergyKeywords.filter(k => allNotes.includes(k));

  return {
    id: `PT-${item.id.replace(/\D/g, "")}`,
    patientId: `PT-${item.id.replace(/\D/g, "")}`,
    queueId: item.queueId || item.id,
    name: item.name,
    age: Number(item.age),
    gender: item.gender,
    time: item.checkInTime,
    status: "pending",
    visitType: item.visitType,
    reason: item.reason,
    vitals: { bloodPressure: item.bloodPressure, heartRate: Number(item.heartRate), temperature: Number(item.temperature) },
    symptoms: "",
    chiefComplaint: "",
    primaryDiagnosis: "",
    notes: "",
    followUp: undefined,
    tests: [],
    medications: [],
    allergies: detectedAllergies.length > 0 ? detectedAllergies : undefined,
    pastVisits: undefined,
historyLoaded: false,
  };
};

export default function Dashboard() {
  const [user, setUser] = useState<{ id: string; fullName: string; role: string; department?: string; employeeId: string; clinicId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicName, setClinicName] = useState("Hospital");
  const [clinicAddress, setClinicAddress] = useState("");
  const [vitalConfigs, setVitalConfigs] = useState<Record<string, string[]>>({});

  const [patients, setPatients] = useState<Patient[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ehrTab, setEhrTab] = useState<"notes" | "history">("notes");
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  // Refs reserved for future alert focus/timer enhancements.
  // Keeping them would trigger unused-var warnings, so they are intentionally removed for now.


  useEffect(() => {
    if (!showAlertPopup) return;

    const close = () => setShowAlertPopup(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showAlertPopup]);


  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [, setIsExamining] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "treating" | "completed" | "revisit">("all");

  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [customDosage, setCustomDosage] = useState("");
  const [newMedFreq, setNewMedFreq] = useState("");
  const [newMedDays, setNewMedDays] = useState("");
  const [newMedRemarks, setNewMedRemarks] = useState("");
  // State for dosage options based on selected drug
  const [dosageOptions, setDosageOptions] = useState<string[]>([]);

  const [editBP, setEditBP] = useState("");
  const [editHR, setEditHR] = useState<string | number>("");
  const [editTemp, setEditTemp] = useState<string | number>("");
  const [editSpO2, setEditSpO2] = useState<string | number>("");
  const [editRR, setEditRR] = useState<string | number>("");
  const [editWeight, setEditWeight] = useState<string | number>("");
  const [editHeight, setEditHeight] = useState<string | number>("");
  const [editIop, setEditIop] = useState("");
  const [editPeakFlow, setEditPeakFlow] = useState<string | number>("");
  const [editBloodGlucose, setEditBloodGlucose] = useState<string | number>("");
  const [editPainScore, setEditPainScore] = useState<string | number>("");
  
  const [editSymptoms, setEditSymptoms] = useState("");
  const [editChiefComplaint, setEditChiefComplaint] = useState("");
  const [editPrimaryDiagnosis, setEditPrimaryDiagnosis] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");
  const [editTests, setEditTests] = useState<string[]>([]);
  const [newTestName, setNewTestName] = useState("");
  const [testSearchOpen, setTestSearchOpen] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState("");

  const [medSearchQuery, setMedSearchQuery] = useState("");
  const [medSearchOpen, setMedSearchOpen] = useState(false);

  const [favMedicines, setFavMedicines] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedFavs = localStorage.getItem("favMedicines");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedFavs) {
        setFavMedicines(JSON.parse(storedFavs));
      }
    } catch {
      // ignore invalid local storage data
    } finally {
      setLoading(false);
    }
  }, []);

  // Update dosage options when medication name changes
  useEffect(() => {
    const matchKey = Object.keys(dosageMap).find(
      (key) => key.toLowerCase() === newMedName.trim().toLowerCase()
    );
    setDosageOptions(matchKey ? dosageMap[matchKey] : dosageDefaults);
    setNewMedDosage("");
  }, [newMedName]);

  const [queue, setQueue] = useState<QueueItem[]>([]);

  const [recFullName, setRecFullName] = useState("");
  const [recAge, setRecAge] = useState("");
  const [recSex, setRecSex] = useState("Male");
  const [recPhone, setRecPhone] = useState("");
  const [recCountryCode, setRecCountryCode] = useState("+1");

  function formatPhoneForCountry(code: string, value: string) {
    const digits = value.replace(/\D/g, "");
    if (code === "+1") {
      const a = digits.slice(0, 3);
      const b = digits.slice(3, 6);
      const c = digits.slice(6, 10);
      return [a, b, c].filter(Boolean).join("-");
    }
    if (code === "+91") {
      const a = digits.slice(0, 5);
      const b = digits.slice(5, 10);
      return [a, b].filter(Boolean).join("-");
    }
    if (code === "+44") {
      const a = digits.slice(0, 4);
      const b = digits.slice(4, 7);
      const c = digits.slice(7, 11);
      return [a, b, c].filter(Boolean).join("-");
    }
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);
    const rest = digits.slice(10);
    const parts = [a, b, c].filter(Boolean);
    if (rest) parts.push(rest);
    return parts.join("-");
  }

  const [recAddress, setRecAddress] = useState("");
  const [recDoctor, setRecDoctor] = useState("");
  const [recDept, setRecDept] = useState("");
  const [recPriority, setRecPriority] = useState("Medium");
  const [recReason, setRecReason] = useState("");
  const [recBP, setRecBP] = useState("");
  const [recPulse, setRecPulse] = useState("");
  const [recTemp, setRecTemp] = useState("");
  const [recSuccessMessage, setRecSuccessMessage] = useState("");
  const [recQueueError, setRecQueueError] = useState("");
  const [availableDoctors, setAvailableDoctors] = useState<DoctorOption[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    if (!token || !storedUser) {
      window.location.href = "/";
      return;
    }

    // Fetch vitals configurations for the clinic
    fetch(`${API_BASE_URL}/api/vital-configs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
          if (data.configs) {
            const mapping: Record<string, string[]> = {};
            data.configs.forEach((cfg: any) => {
              mapping[cfg.department.toLowerCase()] = cfg.vitals;
            });
            setVitalConfigs(mapping);
          }
        })
        .catch(console.error);
  }, []);

useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    const parsedUser = JSON.parse(storedUser);

    // Prefer the clinicId from the logged-in user state in case localStorage differs
    const clinicId = parsedUser?.clinicId || user?.clinicId;
    if (!clinicId) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
    // Fetch only the needed clinic to avoid wrong matches
    fetch(`${API_BASE}/api/clinics/${encodeURIComponent(clinicId)}`)
      .then(r => r.json())
      .then(data => {
        // API may return either the clinic object directly or { clinic }
        const clinic = data?.clinic || data;
        if (clinic?.name) {
          setClinicName(clinic.name);
          setClinicAddress(clinic.address || "");
        }
      })
      .catch(() => {
        // Fallback to old behavior if /api/clinics/:id is not available
        fetch(`${API_BASE}/api/clinics`)
          .then(r => r.json())
          .then(data => {
            const match = (data.clinics || []).find((c: { id: string; name: string; address?: string }) => c.id === clinicId);
            if (match) {
              setClinicName(match.name);
              setClinicAddress(match.address || "");
            }
          })
          .catch(() => {});
      });
  }, [user?.clinicId]);

  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "patients">("overview");

  useEffect(() => {
    const storedVersion = localStorage.getItem(DASHBOARD_STORAGE_VERSION_KEY);
    if (storedVersion !== DASHBOARD_STORAGE_VERSION) {
      localStorage.removeItem("patients");
      localStorage.removeItem("queue");
      localStorage.setItem(DASHBOARD_STORAGE_VERSION_KEY, DASHBOARD_STORAGE_VERSION);
      setPatients([]);
      setQueue([]);
      return;
    }

    const stored = localStorage.getItem("patients");
    let loadedPatients: Patient[] = [];
    if (stored) {
      try {
        loadedPatients = (JSON.parse(stored) as Patient[])
          .map((patient) => ({
            ...patient,
            symptoms: patient.symptoms || "",
            chiefComplaint: patient.chiefComplaint || "",
            primaryDiagnosis: patient.primaryDiagnosis || "",
            tests: patient.tests || [],
            pastVisits: patient.pastVisits || [],
          }));
        setPatients(loadedPatients);
      } catch {
      }
    }

    const storedQueue = localStorage.getItem("queue");
    if (storedQueue) {
      try {
        const parsedQueue = JSON.parse(storedQueue) as QueueItem[];
        setQueue(parsedQueue);
        if (parsedQueue.length && loadedPatients.length === 0) {
          setPatients(parsedQueue.map((item) => queueItemToPatient(item, loadedPatients)));
        }
      } catch {
      }
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "doctor") return;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

    const loadPatientsFromApi = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/patients?doctorId=${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          window.location.href = "/";
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        const apiPatients: Patient[] = (data.patients || []).map((item: QueueItem & {
          symptoms?: string; chiefComplaint?: string; primaryDiagnosis?: string;
          notes?: string; followUp?: string; tests?: string[]; medications?: Patient["medications"];
          patientId?: string; status?: string; visitType?: "new" | "revisit" | "followup";
          visitCount?: number;
          spO2?: number;
          respiratoryRate?: number;
          weight?: number;
          height?: number;
          iop?: string;
          peakFlow?: number;
          bloodGlucose?: number;
          painScore?: number;
        }) => ({
          id: item.id,
          patientId: item.patientId,
          queueId: item.queueId || item.id,
          name: item.name,
          age: item.age,
          gender: item.gender,
          phone: item.phone,
          doctor: item.doctor,
          department: item.department,
          visitCount: item.visitCount,
          time: item.checkInTime,
          status: (item.status as Patient["status"]) || "pending",
          visitType: item.visitType,
          reason: item.reason,
          vitals: {
            bloodPressure: item.bloodPressure || "",
            heartRate: Number(item.heartRate) || 0,
            temperature: Number(item.temperature) || 0,
            spO2: item.spO2 !== undefined && item.spO2 !== null ? Number(item.spO2) : undefined,
            respiratoryRate: item.respiratoryRate !== undefined && item.respiratoryRate !== null ? Number(item.respiratoryRate) : undefined,
            weight: item.weight !== undefined && item.weight !== null ? Number(item.weight) : undefined,
            height: item.height !== undefined && item.height !== null ? Number(item.height) : undefined,
            iop: item.iop || undefined,
            peakFlow: item.peakFlow !== undefined && item.peakFlow !== null ? Number(item.peakFlow) : undefined,
            bloodGlucose: item.bloodGlucose !== undefined && item.bloodGlucose !== null ? Number(item.bloodGlucose) : undefined,
            painScore: item.painScore !== undefined && item.painScore !== null ? Number(item.painScore) : undefined,
          },
          symptoms: item.symptoms || "",
          chiefComplaint: item.chiefComplaint || "",
          primaryDiagnosis: item.primaryDiagnosis || "",
          notes: item.notes || "",
          followUp: item.followUp,
          tests: item.tests || [],
          medications: item.medications || [],
        }));
        setPatients(apiPatients);
      } catch (err) {
        console.error("Failed to load patients from API:", err);
      }
    };

    loadPatientsFromApi();
    const interval = setInterval(loadPatientsFromApi, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "receptionist") return;

    const loadDoctors = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
        const res = await fetch(`${baseUrl}/api/auth/doctors`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
          },
        });
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            window.location.href = "/";
          }
          return;
        }
        const data = await res.json();
        setAvailableDoctors(data.doctors || []);
      } catch (error) {
        console.error("Failed to fetch doctors", error);
      }
    };

    loadDoctors();
  }, [user]);

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  useEffect(() => {
    if (activePatient) {
      setEditBP(activePatient.vitals.bloodPressure);
      setEditHR(activePatient.vitals.heartRate.toString());
      setEditTemp(activePatient.vitals.temperature.toString());
      setEditSpO2((activePatient.vitals.spO2 ?? "").toString());
      setEditRR((activePatient.vitals.respiratoryRate ?? "").toString());
      setEditWeight((activePatient.vitals.weight ?? "").toString());
      setEditHeight((activePatient.vitals.height ?? "").toString());
      setEditIop(activePatient.vitals.iop ?? "");
      setEditPeakFlow((activePatient.vitals.peakFlow ?? "").toString());
      setEditBloodGlucose((activePatient.vitals.bloodGlucose ?? "").toString());
      setEditPainScore((activePatient.vitals.painScore ?? "").toString());
      setEditSymptoms(activePatient.symptoms ?? "");
      setEditChiefComplaint(activePatient.chiefComplaint ?? "");
      setEditPrimaryDiagnosis(activePatient.primaryDiagnosis ?? "");
      setEditNotes(activePatient.notes);
      setEditFollowUp(activePatient.followUp ?? "");
      setEditTests(activePatient.tests ?? []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatient?.id]);

  useEffect(() => {
    if (!activePatient) return;
    setEhrTab("notes");
    if (activePatient.historyLoaded) {
  console.log("[History Effect] already loaded, skipping fetch");
  return;
}

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.warn("[History Effect] No access token, cannot fetch history");
      // Initialize empty pastVisits to prevent indefinite spinner
      setActivePatient(prev => prev && { ...prev, pastVisits: [] });
      setPatients(prev => prev.map(p => p.id === activePatient?.id ? { ...p, pastVisits: [] } : p));
      return;
    }

    const fetchHistory = async () => {
      console.log("[History Fetch] Starting fetch for patient", activePatient?.queueId);
        const patientId = activePatient.id;  // 👈 ADD THIS LINE HERE
      try {
        const recRes = await fetch(`${API_BASE}/api/patients/${activePatient.queueId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!recRes.ok) {
          console.error("[History Fetch] Failed to fetch patient record", recRes.status);
          return;
        }
        const recData = await recRes.json();
        const phone: string = recData.patient?.phone;
        if (!phone) {
          console.warn("[History Fetch] No phone number found for patient");
          return;
        }

        const histRes = await fetch(
          `${API_BASE}/api/patients/history/${encodeURIComponent(phone)}?excludeId=${activePatient.queueId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!histRes.ok) {
          console.error("[History Fetch] Failed to fetch patient history", histRes.status);
          return;
        }
        const histData = await histRes.json();
        const history: Patient["pastVisits"] = (histData.history || []).map((h: any) => ({
          date: h.date,
          diagnosis: h.diagnosis || "",
          medications: h.medications || [],
          tests: h.tests || [],
          notes: h.notes || "",
          visitType: h.visitType,
          chiefComplaint: h.chiefComplaint,
          symptoms: h.symptoms,
          bloodPressure: h.bloodPressure,
          heartRate: h.heartRate,
          temperature: h.temperature,
          doctor: h.doctor,
          patientId: h.patientId,
        }));

        if (history && history.length > 0) {
  console.log(`[History Fetch] Retrieved ${history.length} past visits`);
  setActivePatient(prev => prev?.id === patientId
  ? { ...prev, pastVisits: history, historyLoaded: true }
  : prev
);
setPatients(prev => prev.map(p =>
  p.id === patientId ? { ...p, pastVisits: history, historyLoaded: true } : p
));
        } else {
          console.log("[History Fetch] No past visits found, setting empty array");
  setActivePatient(prev => prev?.id === patientId ? { ...prev, pastVisits: [] } : prev);
  setPatients(prev => prev.map(p => p.id === patientId ? { ...p, pastVisits: [] } : p));
        }
      } catch (err) {
        console.error('[History Fetch] Unexpected error while loading patient history:', err);
  setActivePatient(prev => prev?.id === patientId ? { ...prev, pastVisits: [] } : prev);
  setPatients(prev => prev.map(p => p.id === patientId ? { ...p, pastVisits: [] } : p));
      }
    };

    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatient?.id]);

  useEffect(() => {
    try {
      localStorage.setItem("patients", JSON.stringify(patients));
    } catch {
    }
  }, [patients]);

  useEffect(() => {
    if (!activePatient) return;

    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    const buildVitalsSafely = (prevVitals: any) => {
  const weight = (editWeight !== "" && editWeight !== undefined && editWeight !== null)
    ? Number(editWeight)
    : prevVitals?.weight;
  const height = (editHeight !== "" && editHeight !== undefined && editHeight !== null)
    ? Number(editHeight)
    : prevVitals?.height;

  // BMI = kg / (height_in_metres)^2
  const bmi = (weight && height && height > 0)
    ? parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1))
    : prevVitals?.bmi;

  return {
    bloodPressure: editBP !== "" ? editBP : prevVitals?.bloodPressure || "",
    heartRate: editHR !== "" ? Number(editHR) : (prevVitals?.heartRate ?? 0),
    temperature: editTemp !== "" ? Number(editTemp) : (prevVitals?.temperature ?? 0),
    ...(editSpO2        !== "" ? { spO2: Number(editSpO2) }                : prevVitals?.spO2 !== undefined        ? { spO2: prevVitals.spO2 } : {}),
    ...(editRR          !== "" ? { respiratoryRate: Number(editRR) }        : prevVitals?.respiratoryRate !== undefined ? { respiratoryRate: prevVitals.respiratoryRate } : {}),
    ...(weight  !== undefined  ? { weight }                                 : {}),
    ...(height  !== undefined  ? { height }                                 : {}),
    ...(bmi     !== undefined  ? { bmi }                                    : {}),
    ...(editIop         !== "" ? { iop: editIop }                           : prevVitals?.iop !== undefined          ? { iop: prevVitals.iop } : {}),
    ...(editPeakFlow    !== "" ? { peakFlow: Number(editPeakFlow) }         : prevVitals?.peakFlow !== undefined      ? { peakFlow: prevVitals.peakFlow } : {}),
    ...(editBloodGlucose !== "" ? { bloodGlucose: Number(editBloodGlucose) }: prevVitals?.bloodGlucose !== undefined  ? { bloodGlucose: prevVitals.bloodGlucose } : {}),
    ...(editPainScore   !== "" ? { painScore: Number(editPainScore) }       : prevVitals?.painScore !== undefined     ? { painScore: prevVitals.painScore } : {}),
  };
};

    autoSaveTimer.current = window.setTimeout(() => {
      setActivePatient(prev => {
        if (!prev || prev.id !== activePatient.id) return prev;
        return {
          ...prev,
          symptoms: editSymptoms !== undefined ? editSymptoms : prev.symptoms ?? "",
chiefComplaint: editChiefComplaint !== undefined ? editChiefComplaint : prev.chiefComplaint ?? "",
primaryDiagnosis: editPrimaryDiagnosis !== undefined ? editPrimaryDiagnosis : prev.primaryDiagnosis ?? "",
notes: editNotes !== undefined ? editNotes : prev.notes ?? "",
tests: Array.isArray(editTests) ? editTests : prev.tests ?? [],
vitals: buildVitalsSafely(prev.vitals),
followUp: editFollowUp !== undefined ? (editFollowUp || undefined) : prev.followUp,
 };
      });
      // REPLACE the entire setPatients map callback (lines 679–689) with:
setPatients((prev) => prev.map(p => {
  if (p.id !== activePatient.id) return p;
  return {
    ...p,
    symptoms: editSymptoms !== undefined ? editSymptoms : p.symptoms ?? "",
    chiefComplaint: editChiefComplaint !== undefined ? editChiefComplaint : p.chiefComplaint ?? "",
    primaryDiagnosis: editPrimaryDiagnosis !== undefined ? editPrimaryDiagnosis : p.primaryDiagnosis ?? "",
    notes: editNotes !== undefined ? editNotes : p.notes ?? "",
    followUp: editFollowUp !== undefined ? (editFollowUp || undefined) : p.followUp,
    tests: Array.isArray(editTests) ? editTests : p.tests ?? [],
    vitals: buildVitalsSafely(p.vitals),
  };
}));
    }, 2000);

    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSymptoms, editChiefComplaint, editPrimaryDiagnosis, editNotes, editTests, editFollowUp, editBP, editHR, editTemp, editSpO2, editRR, editWeight, editHeight, editIop, editPeakFlow, editBloodGlucose, editPainScore, activePatient?.id]);

  function addMedication(e: React.FormEvent) {
    e.preventDefault();
    const finalDosage = newMedDosage === "custom" ? customDosage : newMedDosage;
    if (!activePatient || !newMedName.trim() || !finalDosage.trim() || !newMedFreq.trim()) return;

    const updatedMeds = [
      ...activePatient.medications,
      {
        name: newMedName.trim(),
        dosage: finalDosage.trim(),
        frequency: newMedFreq.trim(),
        days: newMedDays.trim(),
        remarks: newMedRemarks.trim() || undefined,
      },
    ];

    const updatedPatient = { ...activePatient, medications: updatedMeds };
    setActivePatient(updatedPatient);
    setPatients(patients.map(p => p.id === activePatient.id ? updatedPatient : p));

    setNewMedName("");
    setNewMedDosage("");
    setCustomDosage("");
    setNewMedFreq("");
    setNewMedDays("");
    setNewMedRemarks("");
  }

  function removeMedication(index: number) {
    if (!activePatient) return;
    const updatedMeds = activePatient.medications.filter((_, idx) => idx !== index);
    const updatedPatient = { ...activePatient, medications: updatedMeds };
    setActivePatient(updatedPatient);
    setPatients(patients.map(p => p.id === activePatient.id ? updatedPatient : p));
  }


  // Fetch full patient details before opening EHR view (fixes missing age/gender/vitals)
  async function fetchAndOpenPatient(p: Patient & { visitCode?: string }) {
    const token = localStorage.getItem("accessToken");
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
    const idsToTry = [p.queueId, p.id].filter(Boolean) as string[];
    let raw: any = null;

    try {
      for (const identifier of idsToTry) {
        const res = await fetch(`${API_BASE}/api/patients/${identifier}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const data = await res.json();
        raw = data.patient || data;
        break;
      }

      if (raw) {
        // Debug: log raw API payload for troubleshooting missing fields
        try { console.log("[fetchAndOpenPatient] raw:", raw); } catch {}
        const merged: Patient = {
          ...p,
          age: raw.age !== undefined && raw.age !== null ? Number(raw.age) : p.age,
          gender: raw.gender || p.gender || "Unknown",
          phone: raw.phone || p.phone,
          address: raw.address || p.address,
          visitCount: raw.visitCount ?? p.visitCount,
          department: raw.department || p.department,
          doctor: raw.doctor || p.doctor,
          vitals: {
            bloodPressure: raw.bloodPressure || p.vitals?.bloodPressure || "",
            heartRate: raw.heartRate !== undefined && raw.heartRate !== null ? Number(raw.heartRate) : p.vitals?.heartRate || 0,
            temperature: raw.temperature !== undefined && raw.temperature !== null ? Number(raw.temperature) : p.vitals?.temperature || 0,
            spO2: raw.spO2 !== undefined && raw.spO2 !== null ? Number(raw.spO2) : p.vitals?.spO2,
            respiratoryRate: raw.respiratoryRate !== undefined && raw.respiratoryRate !== null ? Number(raw.respiratoryRate) : p.vitals?.respiratoryRate,
            weight: raw.weight !== undefined && raw.weight !== null ? Number(raw.weight) : p.vitals?.weight,
            height: raw.height !== undefined && raw.height !== null ? Number(raw.height) : p.vitals?.height,
            iop: raw.iop !== undefined && raw.iop !== null ? raw.iop : p.vitals?.iop,
            peakFlow: raw.peakFlow !== undefined && raw.peakFlow !== null ? Number(raw.peakFlow) : p.vitals?.peakFlow,
            bloodGlucose: raw.bloodGlucose !== undefined && raw.bloodGlucose !== null ? Number(raw.bloodGlucose) : p.vitals?.bloodGlucose,
            painScore: raw.painScore !== undefined && raw.painScore !== null ? Number(raw.painScore) : p.vitals?.painScore,
          },
          chiefComplaint: raw.chiefComplaint || p.chiefComplaint || "",
          primaryDiagnosis: raw.primaryDiagnosis || p.primaryDiagnosis || "",
          symptoms: raw.symptoms || p.symptoms || "",
          notes: raw.notes || p.notes || "",
          tests: raw.tests || p.tests || [],
          medications: raw.medications || p.medications || [],
        };
        // Debug: log merged patient object before setting state
        try { console.log("[fetchAndOpenPatient] merged:", merged); } catch {}
        setActivePatient(merged);
        setPatients((prev) => prev.map((item) => item.id === merged.id ? merged : item));
      } else {
        setActivePatient(p);
      }
    } catch {
      setActivePatient(p);
    }

    setIsExamining(true);
    setActiveTab("overview");
  }

  function addTest(e: React.FormEvent) {
    e.preventDefault();
    if (!activePatient || !newTestName.trim()) return;
    const updatedTests = [...(activePatient.tests || []), newTestName.trim()];
    const updatedPatient = { ...activePatient, tests: updatedTests };
    setActivePatient(updatedPatient);
    setPatients(patients.map(p => p.id === activePatient.id ? updatedPatient : p));
    setNewTestName("");
  }
445
  function removeTest(index: number) {
    if (!activePatient) return;
    const updatedTests = (activePatient.tests || []).filter((_, idx) => idx !== index);
    const updatedPatient = { ...activePatient, tests: updatedTests };
    setActivePatient(updatedPatient);
    setPatients(patients.map(p => p.id === activePatient.id ? updatedPatient : p));
  }

  function downloadPrescriptionPdf() {
    if (!activePatient) return;

    const esc = (v: string) =>
      String(v ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

    const wrapText = (txt: string, maxChars = 60): string[] => {
      if (!txt || !txt.trim()) return ["-"];
      const words = txt.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        if ((line ? line + " " + word : word).length <= maxChars) {
          line = line ? line + " " + word : word;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    const PAGE_W   = 612;
    const PAGE_H   = 792;
    const MARGIN   = 48;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const ROW_H    = 22;
    const COL1_W   = 160;
    const CELL_BL  = 14;

    const pages: string[][] = [];
    let s: string[] = [];
    let Y = PAGE_H - 48;

    const flush  = () => { if (s.length) { pages.push(s); s = []; } };
    const needY  = (space: number) => {
      if (Y - space < 60) { flush(); Y = PAGE_H - 48; renderPageHeader(); }
    };

    const fillRect = (x: number, yTop: number, w: number, h: number, gray: number) => {
      s.push(`${gray.toFixed(2)} ${gray.toFixed(2)} ${gray.toFixed(2)} rg`);
      s.push(`${x} ${yTop - h} ${w} ${h} re f`);
      s.push(`0 0 0 rg`);
    };
    const strokeRect = (x: number, yTop: number, w: number, h: number, lw = 0.5) => {
      s.push(`${lw} w 0.65 0.65 0.65 RG`);
      s.push(`${x} ${yTop - h} ${w} ${h} re S`);
      s.push(`0 0 0 RG`);
    };
    const hLine = (x1: number, x2: number, y: number, lw = 0.4, gray = 0.75) => {
      s.push(`${lw} w ${gray.toFixed(2)} ${gray.toFixed(2)} ${gray.toFixed(2)} RG`);
      s.push(`${x1} ${y} m ${x2} ${y} l S`);
      s.push(`0 0 0 RG`);
    };
    const vLine = (x: number, yTop: number, yBot: number, lw = 0.4) => {
      s.push(`${lw} w 0.75 0.75 0.75 RG`);
      s.push(`${x} ${yTop} m ${x} ${yBot} l S`);
      s.push(`0 0 0 RG`);
    };
    const text = (txt: string, x: number, y: number, font: "F1"|"F2", size: number, r=0, g=0, b=0) => {
      s.push(`BT /${font} ${size} Tf ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg ${x} ${y} Td (${esc(txt)}) Tj ET`);
      s.push(`0 0 0 rg`);
    };

    const HEADER_H = 54;
    const renderPageHeader = () => {
      fillRect(MARGIN, Y, CONTENT_W, HEADER_H, 0.12);
      text(esc(clinicName), MARGIN + 14, Y - 18, "F2", 17, 1, 1, 1);
      text("Prescription & Electronic Health Record", MARGIN + 14, Y - 33, "F1", 8, 0.75, 0.75, 0.75);
      if (clinicAddress) text(esc(clinicAddress), MARGIN + 14, Y - 47, "F1", 7, 0.65, 0.65, 0.65);
      const dateStr = new Date().toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" });
      text(`Date: ${dateStr}`, PAGE_W - MARGIN - 138, Y - 18, "F1", 8, 0.8, 0.8, 0.8);
      text(`Patient: ${esc(activePatient.name)}`, PAGE_W - MARGIN - 138, Y - 32, "F1", 8, 0.75, 0.75, 0.75);
      if (user?.department) text(`Dept: ${esc(user.department)}`, PAGE_W - MARGIN - 138, Y - 46, "F1", 7.5, 0.65, 0.65, 0.65);
      Y -= HEADER_H + 8;
    };

    const SECTION_H = 20;
    const sectionTitle = (title: string) => {
      needY(SECTION_H + 4);
      Y -= 10;
      fillRect(MARGIN, Y, CONTENT_W, SECTION_H, 0.20);
      text(title.toUpperCase(), MARGIN + 10, Y - (SECTION_H - 7), "F2", 7.5, 1, 1, 1);
      Y -= SECTION_H + 2;
    };

    const infoTableRows = (rows: [string, string][]) => {
      const tableH = rows.length * ROW_H;
      needY(tableH + 4);
      const tableTop = Y;
      rows.forEach(([label, value], i) => {
        const rowTop  = tableTop - i * ROW_H;
        const baseline = rowTop - CELL_BL;
        if (i % 2 === 1) fillRect(MARGIN, rowTop, CONTENT_W, ROW_H, 0.965);
        fillRect(MARGIN, rowTop, COL1_W, ROW_H, 0.905);
        text(label, MARGIN + 8, baseline, "F2", 8.5);
        text(wrapText(value || "-", 56)[0], MARGIN + COL1_W + 8, baseline, "F1", 8.5);
        if (i < rows.length - 1) hLine(MARGIN, MARGIN + CONTENT_W, rowTop - ROW_H, 0.4, 0.82);
        vLine(MARGIN + COL1_W, rowTop, rowTop - ROW_H);
      });
      strokeRect(MARGIN, tableTop, CONTENT_W, tableH);
      Y -= tableH + 6;
    };

    const wrapRow = (label: string, value: string) => {
      const lines = wrapText(value || "-", 64);
      const rowH  = Math.max(ROW_H, lines.length * 14 + 12);
      needY(rowH + 4);
      const rowTop = Y;
      fillRect(MARGIN, rowTop, COL1_W, rowH, 0.905);
      vLine(MARGIN + COL1_W, rowTop, rowTop - rowH);
      text(label, MARGIN + 8, rowTop - CELL_BL, "F2", 8.5);
      lines.forEach((line, li) => text(line, MARGIN + COL1_W + 8, rowTop - CELL_BL - li * 14, "F1", 8.5));
      strokeRect(MARGIN, rowTop, CONTENT_W, rowH);
      Y -= rowH + 4;
    };

    const medicationsTable = (meds: typeof activePatient.medications) => {
      const cols = [28, 140, 76, 96, 50, CONTENT_W - 28 - 140 - 76 - 96 - 50];
      const headers = ["#", "Drug / Medicine", "Dosage", "Frequency", "Days", "Remarks"];
      const HDR_H = 20;
      const totalH = HDR_H + meds.length * ROW_H;
      needY(totalH + 4);
      const tableTop = Y;
      fillRect(MARGIN, tableTop, CONTENT_W, HDR_H, 0.16);
      let cx = MARGIN;
      headers.forEach((h, hi) => { text(h, cx + 6, tableTop - (HDR_H - 7), "F2", 7.5, 1, 1, 1); cx += cols[hi]; });
      meds.forEach((med, i) => {
        const rowTop  = tableTop - HDR_H - i * ROW_H;
        const baseline = rowTop - CELL_BL;
        if (i % 2 === 1) fillRect(MARGIN, rowTop, CONTENT_W, ROW_H, 0.965);
        hLine(MARGIN, MARGIN + CONTENT_W, rowTop, 0.3, 0.82);
        const cells = [String(i+1), med.name||"-", med.dosage||"-", med.frequency||"-", med.days?`${med.days}d`:"-", med.remarks||"-"];
        let colX = MARGIN;
        cells.forEach((cell, ci) => {
          text(wrapText(cell, Math.max(4, Math.floor(cols[ci]/5.8)))[0], colX+6, baseline, ci===0?"F2":"F1", 8);
          vLine(colX+cols[ci], rowTop, rowTop-ROW_H);
          colX += cols[ci];
        });
      });
      strokeRect(MARGIN, tableTop, CONTENT_W, totalH);
      Y -= totalH + 6;
    };

    const testsTable = (tests: string[]) => {
      const HDR_H = 20; const NUM_COL = 32; const STATUS_COL = 80;
      const totalH = HDR_H + tests.length * ROW_H;
      needY(totalH + 4);
      const tableTop = Y;
      fillRect(MARGIN, tableTop, CONTENT_W, HDR_H, 0.16);
      text("#",                        MARGIN+6,                         tableTop-(HDR_H-7), "F2", 7.5, 1,1,1);
      text("Investigation / Lab Test", MARGIN+NUM_COL+6,                 tableTop-(HDR_H-7), "F2", 7.5, 1,1,1);
      text("Status",                   MARGIN+CONTENT_W-STATUS_COL+6,    tableTop-(HDR_H-7), "F2", 7.5, 1,1,1);
      tests.forEach((test, i) => {
        const rowTop  = tableTop - HDR_H - i * ROW_H;
        const baseline = rowTop - CELL_BL;
        if (i % 2 === 1) fillRect(MARGIN, rowTop, CONTENT_W, ROW_H, 0.965);
        hLine(MARGIN, MARGIN+CONTENT_W, rowTop, 0.3, 0.82);
        text(String(i+1), MARGIN+6,                      baseline, "F2", 8.5);
        text(test,        MARGIN+NUM_COL+6,               baseline, "F1", 8.5);
        text("Ordered",   MARGIN+CONTENT_W-STATUS_COL+6,  baseline, "F1", 8, 0.15,0.5,0.15);
        vLine(MARGIN+NUM_COL,               rowTop, rowTop-ROW_H);
        vLine(MARGIN+CONTENT_W-STATUS_COL,  rowTop, rowTop-ROW_H);
      });
      strokeRect(MARGIN, tableTop, CONTENT_W, totalH);
      Y -= totalH + 6;
    };

    const renderFooter = () => {
      const fy = 38;
      hLine(MARGIN, MARGIN+CONTENT_W, fy+14, 0.5, 0.6);
      text(`This document is computer-generated. ${esc(clinicName)}.`, MARGIN, fy, "F1", 7, 0.55,0.55,0.55);
      text(`Page ${pages.length+1}`, PAGE_W-MARGIN-36, fy, "F1", 7.5, 0.55,0.55,0.55);
    };

    renderPageHeader();

    sectionTitle("Patient Demographics");
    infoTableRows([
      ["Patient ID",  activePatient.patientId || activePatient.id],
      ["Full Name",   activePatient.name],
      ["Age",         activePatient.age ? `${activePatient.age} Years` : "-"],
      ["Gender",      activePatient.gender || "-"],
      ["Doctor",      user?.fullName ? `Dr. ${esc(user.fullName)}` : "-"],
      ["Report Date", new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })],
    ]);
    Y -= 8;

    sectionTitle("Clinical Vitals");
    infoTableRows([
      ["Blood Pressure",   activePatient.vitals?.bloodPressure   || "-"],
      ["Heart Rate",       activePatient.vitals?.heartRate       ? `${activePatient.vitals.heartRate} bpm`  : "-"],
      ["Body Temperature", activePatient.vitals?.temperature     ? `${activePatient.vitals.temperature} \xb0F` : "-"],
    ]);
    Y -= 8;

    sectionTitle("Clinical Assessment & Notes");
    wrapRow("Chief Complaint",   activePatient.chiefComplaint   || "-");
    wrapRow("Symptoms",          activePatient.symptoms         || "-");
    wrapRow("Primary Diagnosis", activePatient.primaryDiagnosis || "-");
    if (activePatient.notes)    wrapRow("Progress Notes",  activePatient.notes);
    if (activePatient.followUp) wrapRow("Follow-up Date",
      new Date(activePatient.followUp).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }));
    Y -= 8;

    sectionTitle("Medication Instructions (Rx)");
    if (!activePatient.medications || activePatient.medications.length === 0) {
      needY(ROW_H + 4);
      fillRect(MARGIN, Y, CONTENT_W, ROW_H + 4, 0.97);
      strokeRect(MARGIN, Y, CONTENT_W, ROW_H + 4);
      text("No medications have been prescribed.", MARGIN + 12, Y - CELL_BL, "F1", 9, 0.55,0.55,0.55);
      Y -= ROW_H + 8;
    } else {
      medicationsTable(activePatient.medications);
    }
    Y -= 8;

    if (activePatient.tests && activePatient.tests.length > 0) {
      sectionTitle("Recommended Investigations & Labs");
      testsTable(activePatient.tests);
      Y -= 8;
    }

    needY(56);
    Y -= 20;
    const sigX = MARGIN + CONTENT_W - 180;
    hLine(sigX, MARGIN + CONTENT_W, Y, 0.6, 0.45);
    text(`Dr. ${esc(user?.fullName ?? "Authorised Signatory")}`, sigX, Y - 14, "F2", 8.5);
    text("Authorised Signature & Stamp", sigX, Y - 26, "F1", 7.5, 0.5,0.5,0.5);

    renderFooter();
    flush();

    const objects: string[] = [];
    const encoder = new TextEncoder();

    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    let kidsArray = "[";
    for (let p = 0; p < pages.length; p++) kidsArray += `${3 + p * 2} 0 R `;
    kidsArray += "]";
    objects.push(`2 0 obj\n<< /Type /Pages /Kids ${kidsArray} /Count ${pages.length} >>\nendobj\n`);

    const fontBase = 3 + pages.length * 2;
    for (let p = 0; p < pages.length; p++) {
      const stream = pages[p].filter(Boolean).join("\n");
      const pageObj = 3 + p * 2;
      const contObj = 4 + p * 2;
      objects.push(`${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R >> >> /Contents ${contObj} 0 R >>\nendobj\n`);
      objects.push(`${contObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    }

    objects.push(`${fontBase} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
    objects.push(`${fontBase + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

    let offset = 0;
    const pdfHeader = "%PDF-1.4\n";
    const parts: BlobPart[] = [encoder.encode(pdfHeader) as unknown as BlobPart];
    offset += pdfHeader.length;
    const xrefs = ["0000000000 65535 f \n"];

    for (const obj of objects) {
      const bytes = encoder.encode(obj);
      xrefs.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
      parts.push(bytes as unknown as BlobPart);
      offset += bytes.length;
    }

    const xrefOffset = offset;
    const xrefTable = [`xref\n0 ${objects.length + 1}\n`, ...xrefs].join("");
    const trailerStr = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(encoder.encode(xrefTable) as unknown as BlobPart);
    parts.push(encoder.encode(trailerStr) as unknown as BlobPart);

    const blob = new Blob(parts, { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activePatient.name.replace(/\s+/g, "_")}_prescription.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function savePatientClinicalNotes() {
    if (!activePatient) return;

    const builtVitals: Patient["vitals"] = {
      bloodPressure: editBP,
      heartRate: Number(editHR),
      temperature: Number(editTemp),
      ...(editSpO2        ? { spO2: Number(editSpO2) }               : {}),
      ...(editRR          ? { respiratoryRate: Number(editRR) }       : {}),
      ...(editWeight      ? { weight: Number(editWeight) }            : {}),
      ...(editHeight      ? { height: Number(editHeight) }            : {}),
      ...(editIop         ? { iop: editIop }                          : {}),
      ...(editPeakFlow    ? { peakFlow: Number(editPeakFlow) }        : {}),
      ...(editBloodGlucose ? { bloodGlucose: Number(editBloodGlucose) } : {}),
      ...(editPainScore    ? { painScore: Number(editPainScore) }       : {}),
    };

    const updatedPatient: Patient = {
      ...activePatient,
      symptoms: editSymptoms,
      chiefComplaint: editChiefComplaint,
      primaryDiagnosis: editPrimaryDiagnosis,
      notes: editNotes,
      tests: editTests,
      vitals: builtVitals,
      followUp: editFollowUp || undefined,
    };

    setActivePatient(updatedPatient);
    setPatients(patients.map(p => p.id === activePatient.id ? updatedPatient : p));

    const token = localStorage.getItem("accessToken");
    if (token && activePatient.queueId) {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}/api/patients/${activePatient.queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          symptoms: editSymptoms,
          chiefComplaint: editChiefComplaint,
          primaryDiagnosis: editPrimaryDiagnosis,
          notes: editNotes,
          tests: editTests,
          bloodPressure: editBP,
          heartRate: Number(editHR),
          temperature: Number(editTemp),
          spO2: editSpO2 || undefined,
          respiratoryRate: editRR || undefined,
          weight: editWeight || undefined,
          height: editHeight || undefined,
          iop: editIop || undefined,
          peakFlow: editPeakFlow || undefined,
          bloodGlucose: editBloodGlucose || undefined,
          painScore: editPainScore || undefined,
          followUp: editFollowUp || undefined,
          medications: updatedPatient.medications,
        }),
      }).catch(console.error);
    }
  }

  async function completeConsultation() {
  if (!activePatient) return;

  // Save latest edits before completing
  await savePatientClinicalNotes();

  const updatedPatient: Patient = { ...activePatient, status: "completed" };
  setActivePatient(updatedPatient);
  setPatients(prev => prev.map(p => p.id === activePatient.id ? updatedPatient : p));

  const token = localStorage.getItem("accessToken");
  if (token && activePatient.queueId) {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000"}/api/patients/${activePatient.queueId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "completed" }),
      }
    ).catch(console.error);
  }
  setActivePatient(null);
  setIsExamining(false);
}

  function handleQueueCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setRecQueueError("");

    const reasonText = recReason.trim();
    const { isCardiac, isFever } = evaluateVitalRequirements(reasonText);

    if (!recFullName.trim() || !recAge.trim() || !recSex || !recPhone.trim() || !recAddress.trim() || !recDoctor || !reasonText) {
      setRecQueueError("Please fill out all required fields before adding the patient to queue.");
      return;
    }

    if (isCardiac && (!recBP.trim() || !recPulse.trim())) {
      setRecQueueError("Cardiac-related intake requires recorded BP and pulse before the patient can join the queue.");
      return;
    }

    if (isFever && !recTemp.trim()) {
      setRecQueueError("Fever-related intake requires a recorded temperature before the patient can join the queue.");
      return;
    }

    const newQueueItem: QueueItem = {
      id: `Q-${100 + queue.length + 1}`,
      name: recFullName.trim(),
      age: Number(recAge),
      gender: recSex,
      phone: `${recCountryCode} ${recPhone.trim()}`,
      address: recAddress.trim(),
      doctor: recDoctor,
      department: recDept,
      reason: reasonText,
      bloodPressure: recBP.trim(),
      heartRate: recPulse.trim(),
      temperature: recTemp.trim(),
      checkInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Waiting",
      priority: recPriority,
    };

    setQueue([...queue, newQueueItem]);
    setPatients([...patients, queueItemToPatient(newQueueItem, patients)]);
    setRecFullName("");
    setRecAge("");
    setRecSex("Male");
    setRecPhone("");
    setRecAddress("");
    setRecDoctor("");
    setRecDept("");
    setRecPriority("Medium");
    setRecReason("");
    setRecBP("");
    setRecPulse("");
    setRecTemp("");

    setRecSuccessMessage("Patient checked in and placed in queue successfully!");
    setTimeout(() => setRecSuccessMessage(""), 4000);
  }

  function handleRemoveQueue(id: string) {
    setQueue(queue.filter(q => q.id !== id));
  }

  function handleSelectDoctor(docName: string) {
    setRecDoctor(docName);
    const doc = availableDoctors.find((d) => d.name === docName);
    if (doc) setRecDept(doc.department ?? "");
  }

  function evaluateVitalRequirements(reason: string) {
    const normalized = reason.toLowerCase();
    const isCardiac = [
      "heart", "cardiac", "chest pain", "palpitation", "tachycardia",
      "hypertension", "bp", "blood pressure", "shortness of breath",
      "angina", "arrhythmia", "heart attack",
    ].some((keyword) => normalized.includes(keyword));
    const isFever = [
      "fever", "temperature", "febrile", "hot", "chills", "sweat",
    ].some((keyword) => normalized.includes(keyword));
    return { isCardiac, isFever };
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  const isDoctor = user.role === "doctor";
  const vitalsRequirements = evaluateVitalRequirements(recReason);

  // ─── Department-specific vitals configuration ─────────────────────────────
  // Each entry defines the vital cards shown in the EHR panel for that specialty.
  // Fields: key (matches state/vitals object), label, unit, color classes, inputType.
  type VitalField = {
    key: string;
    label: string;
    unit: string;
    color: string;           // Tailwind bg+border+label color classes
    inputType: "text" | "number";
    step?: string;
    placeholder: string;
  };

  const ALL_VITALS: Record<string, VitalField> = {
    bloodPressure:   { key: "bloodPressure",   label: "Blood Pressure",    unit: "mmHg",  color: "bg-sky-50/60 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900/40 text-sky-500",     inputType: "text",   placeholder: "120/80" },
    heartRate:       { key: "heartRate",       label: "Heart Rate",        unit: "bpm",   color: "bg-rose-50/60 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 text-rose-500",   inputType: "number", placeholder: "72" },
    temperature:     { key: "temperature",     label: "Temperature",       unit: "°F",    color: "bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40 text-amber-500", inputType: "number", step: "0.1", placeholder: "98.6" },
    spO2:            { key: "spO2",            label: "SpO₂",              unit: "%",     color: "bg-teal-50/60 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/40 text-teal-500",    inputType: "number", placeholder: "98" },
    respiratoryRate: { key: "respiratoryRate", label: "Respiratory Rate",   unit: "/min",  color: "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40 text-indigo-500", inputType: "number", placeholder: "16" },
    weight:          { key: "weight",          label: "Weight",            unit: "kg",    color: "bg-violet-50/60 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40 text-violet-500", inputType: "number", step: "0.1", placeholder: "70" },
    height:          { key: "height",          label: "Height",            unit: "cm",    color: "bg-purple-50/60 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/40 text-purple-500", inputType: "number", placeholder: "170" },
    iop:             { key: "iop",             label: "IOP (L / R)",       unit: "mmHg",  color: "bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/40 text-cyan-500",      inputType: "text",   placeholder: "14/15" },
    peakFlow:        { key: "peakFlow",        label: "Peak Flow",         unit: "L/min", color: "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-500", inputType: "number", placeholder: "400" },
    bloodGlucose:    { key: "bloodGlucose",    label: "Blood Glucose",     unit: "mg/dL", color: "bg-orange-50/60 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/40 text-orange-500", inputType: "number", placeholder: "100" },
    painScore:       { key: "painScore",       label: "Pain Score",        unit: "/ 10",  color: "bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 text-red-500",         inputType: "number", placeholder: "0" },
  };

  // Department → ordered list of vital field keys to display
  const DEPT_VITALS: Record<string, string[]> = {
    Cardiology:      ["bloodPressure", "heartRate", "spO2", "respiratoryRate"],
    Neurology:       ["bloodPressure", "heartRate", "temperature", "painScore"],
    Pediatrics:      ["temperature", "heartRate", "respiratoryRate", "spO2", "weight", "height"],
    Oncology:        ["bloodPressure", "heartRate", "temperature", "weight", "painScore"],
    Orthopedics:     ["bloodPressure", "heartRate", "temperature", "painScore", "weight"],
    Gynecology:      ["bloodPressure", "heartRate", "temperature", "weight", "height"],
    Pulmonology:     ["spO2", "respiratoryRate", "peakFlow", "heartRate", "bloodPressure"],
    Gastroenterology:["bloodPressure", "heartRate", "temperature", "weight", "painScore"],
    Endocrinology:   ["bloodGlucose", "bloodPressure", "heartRate", "weight", "height"],
    Nephrology:      ["bloodPressure", "heartRate", "temperature", "weight"],
    Dermatology:     ["bloodPressure", "temperature", "painScore"],
    Psychiatry:      ["bloodPressure", "heartRate", "temperature", "weight"],
    Ophthalmology:   ["iop", "bloodPressure", "bloodGlucose"],
    ENT:             ["bloodPressure", "heartRate", "temperature", "painScore"],
    Urology:         ["bloodPressure", "heartRate", "temperature", "painScore"],
    General:         ["bloodPressure", "heartRate", "temperature", "spO2"],
  };

  const DEPT_ALIASES: { key: string; keywords: string[] }[] = [
    { key: "Cardiology",       keywords: ["cardio", "cardiac", "heart", "cardiolog"] },
    { key: "Neurology",        keywords: ["neuro", "neurolog", "brain", "spine neurol"] },
    { key: "Pediatrics",       keywords: ["pediatr", "paediatr", "paediat", "child", "neonat", "infant", "kid"] },
    { key: "Oncology",         keywords: ["oncol", "cancer", "tumor", "tumour", "haematol", "hematol"] },
    { key: "Orthopedics",      keywords: ["ortho", "bone", "joint", "musculo", "skeletal", "fracture"] },
    { key: "Gynecology",       keywords: ["gynecol", "gynaecol", "obstet", "women", "maternal", "reproductive"] },
    { key: "Pulmonology",      keywords: ["pulmon", "respir", "lung", "chest", "bronch", "thorac"] },
    { key: "Gastroenterology", keywords: ["gastro", "digestive", "liver", "hepat", "bowel", "colon", "gi "] },
    { key: "Endocrinology",    keywords: ["endocrin", "diabet", "thyroid", "hormone", "metabol"] },
    { key: "Nephrology",       keywords: ["nephrol", "kidney", "renal", "urin"] },
    { key: "Dermatology",      keywords: ["dermatol", "skin", "cosmet"] },
    { key: "Psychiatry",       keywords: ["psychiatr", "mental", "psychol", "behav"] },
    { key: "Ophthalmology",    keywords: ["ophthal", "eye", "vision", "retina", "ocul"] },
    { key: "ENT",              keywords: ["ent", "ear", "nose", "throat", "otolaryng", "audiol"] },
    { key: "Urology",          keywords: ["urol", "bladder", "prostate", "urinary"] },
    { key: "General",          keywords: ["general", "family", "gp ", "internal", "medicine", "primary"] },
  ];

  function getDeptVitals(department?: string): VitalField[] {
    const dept = (department ?? user?.department ?? "").trim().toLowerCase();
    
    // 1. Try to find a custom configuration matching this department directly
    if (vitalConfigs[dept]) {
      const fieldKeys = vitalConfigs[dept];
      return fieldKeys.map(k => ALL_VITALS[k]).filter(Boolean);
    }

    // 2. Otherwise try keyword aliases mapping to configs if configured, or fall back to default groups
    const match = DEPT_ALIASES.find(({ keywords }) =>
      keywords.some(kw => dept.includes(kw))
    );
    
    const resolvedKey = match ? match.key : "General";
    
    // Check if there is a config in database matching the resolved alias key (e.g. "pediatrics")
    if (vitalConfigs[resolvedKey.toLowerCase()]) {
      const fieldKeys = vitalConfigs[resolvedKey.toLowerCase()];
      return fieldKeys.map(k => ALL_VITALS[k]).filter(Boolean);
    }

    // 3. Fallback to hardcoded defaults
    const fieldKeys = DEPT_VITALS[resolvedKey] ?? DEPT_VITALS["General"];
    return fieldKeys.map(k => ALL_VITALS[k]).filter(Boolean);
  }

  function getVitalValue(fieldKey: string): string | number {
    // Prefer the transient edited value (when examining), otherwise fall back
    // to the stored value on the loaded `activePatient` record.
    const valFromEdit = (() => {
      switch (fieldKey) {
        case "bloodPressure":   return editBP;
        case "heartRate":       return editHR;
        case "temperature":     return editTemp;
        case "spO2":            return editSpO2;
        case "respiratoryRate": return editRR;
        case "weight":          return editWeight;
        case "height":          return editHeight;
        case "iop":             return editIop;
        case "peakFlow":        return editPeakFlow;
        case "bloodGlucose":    return editBloodGlucose;
        case "painScore":       return editPainScore;
        default:                return "";
      }
    })();

    if (valFromEdit !== undefined && valFromEdit !== null && String(valFromEdit).trim() !== "") return valFromEdit;

    if (activePatient && activePatient.vitals) {
      const vp: any = (activePatient as any).vitals || {};
      const stored = vp[fieldKey];
      if (stored !== undefined && stored !== null && String(stored).trim() !== "") return stored;
    }

    return "";
  }

  function setVitalValue(fieldKey: string, raw: string) {
    switch (fieldKey) {
      case "bloodPressure":   setEditBP(raw); break;
      case "heartRate":       setEditHR(raw); break;
      case "temperature":     setEditTemp(raw); break;
      case "spO2":            setEditSpO2(raw); break;
      case "respiratoryRate": setEditRR(raw); break;
      case "weight":          setEditWeight(raw); break;
      case "height":          setEditHeight(raw); break;
      case "iop":             setEditIop(raw); break;
      case "peakFlow":        setEditPeakFlow(raw); break;
      case "bloodGlucose":    setEditBloodGlucose(raw); break;
      case "painScore":       setEditPainScore(raw); break;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clinical reference ranges (adult, general-population defaults).
   * Returns "high" | "low" | "normal" | "none" (no value entered).
   * bloodPressure is parsed as systolic/diastolic.
   */
  type VitalStatus = "high" | "low" | "normal" | "none";
  function getVitalStatus(key: string): VitalStatus {
    switch (key) {
      case "bloodPressure": {
        // For completed-view we don't rely on editBP; use patient vitals.
        // Prefer edit value when examining, otherwise compute from activePatient.vitals.
        const bpForCheck = (editBP && editBP.includes("/"))
          ? editBP
          : (() => {
              const v: any = (activePatient as any)?.vitals || {};
              const storedBp = v?.bloodPressure;
              return typeof storedBp === "string" && storedBp.includes("/") ? storedBp : "";
            })();

        if (!bpForCheck) return "none";
        const [sys, dia] = bpForCheck.split("/").map(Number);
        if (isNaN(sys) || isNaN(dia)) return "none";
        if (sys >= 140 || dia >= 90) return "high";
        if (sys < 90  || dia < 60)  return "low";
        return "normal";
      }
      case "heartRate": {
        const value = Number(editHR);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value > 100) return "high";
        if (value < 60)  return "low";
        return "normal";
      }
      case "temperature": {
        const value = Number(editTemp);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value > 99.5) return "high";
        if (value < 97.0) return "low";
        return "normal";
      }
      case "spO2": {
        const value = Number(editSpO2);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value < 90) return "low";
        if (value < 95) return "low";
        return "normal";
      }
      case "respiratoryRate": {
        const value = Number(editRR);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value > 20) return "high";
        if (value < 12) return "low";
        return "normal";
      }
      case "bloodGlucose": {
        const value = Number(editBloodGlucose);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value > 180) return "high";
        if (value < 70)  return "low";
        return "normal";
      }
      case "painScore": {
        const value = Number(editPainScore);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value >= 7) return "high";
        if (value >= 4) return "high";
        if (value > 0)  return "normal";
        return "none";
      }
      case "peakFlow": {
        const value = Number(editPeakFlow);
        if (Number.isNaN(value) || value === 0) return "none";
        if (value < 200) return "low";
        return "normal";
      }
      case "weight": {
        const value = Number(editWeight);
        if (Number.isNaN(value) || value === 0) return "none";
        // Simple reference: 50–100kg considered normal
        if (value < 50) return "low";
        if (value > 100) return "high";
        return "normal";
      }
      case "height": {
        const value = Number(editHeight);
        if (Number.isNaN(value) || value === 0) return "none";
        // Simple reference: 120–200cm considered normal
        if (value < 120) return "low";
        if (value > 200) return "high";
        return "normal";
      }
      case "iop": {
        const value = Number(editIop);
        if (Number.isNaN(value) || value === 0) return "none";
        // If entered as a number, 10–21mmHg considered normal
        if (value < 10) return "low";
        if (value > 21) return "high";
        return "normal";
      }
      default:
        return "none";
    }
  }

  /** Renders the small indicator badge for a vital status */
function VitalIndicator({ status }: { status: VitalStatus }) {
    // Completed patients need a visible status badge too.
    if (status === "none") return null;
    if (status === "high") return (
      <span
        title="Above normal range"
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1 L9 9 L1 9 Z" /></svg>
        High
      </span>
    );
    if (status === "low") return (
      <span
        title="Below normal range"
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor"><path d="M5 9 L9 1 L1 1 Z" /></svg>
        Low
      </span>
    );
    // normal
    return (
      <span
        title="Within normal range"
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Normal
      </span>
    );
  }

  const DEPT_TESTS: Record<string, string[]> = {
    Cardiology: ["ECG / EKG","Echocardiogram","Troponin I","CRP (C-Reactive Protein)","Lipid Panel","D-Dimer","PT / INR","Chest X-Ray","CT Scan Chest","Blood Pressure Monitoring","Holter Monitor","Stress Test","BNP / NT-proBNP","Cardiac Catheterization"],
    Neurology: ["MRI Brain","MRI Spine","CT Scan Head","EEG","Nerve Conduction Study","Lumbar Puncture","CSF Analysis","Carotid Doppler","Visual Evoked Potentials","Serum B12","Thyroid Function (TSH)","Complete Blood Count (CBC)"],
    Pediatrics: ["Complete Blood Count (CBC)","Blood Glucose (Fasting)","Urinalysis","Stool Routine","Chest X-Ray","Thyroid Function (TSH)","Hearing Screen","Vision Screen","Developmental Screening","Dengue NS1 Antigen","Malaria Rapid Test","Widal Test","HBsAg"],
    Oncology: ["CT Scan Chest","CT Scan Abdomen","MRI Brain","PET Scan","Biopsy","Tumor Markers (AFP)","PSA (Prostate)","CA-125","CA 19-9","CEA","Complete Blood Count (CBC)","Comprehensive Metabolic Panel (CMP)","Bone Marrow Biopsy","Mammogram"],
    Orthopedics: ["X-Ray Spine","X-Ray Knee","X-Ray Hip","X-Ray Shoulder","MRI Spine","MRI Knee","Bone Density (DEXA)","CRP (C-Reactive Protein)","ESR","Uric Acid","Rheumatoid Factor","Anti-CCP","Complete Blood Count (CBC)","Bone Scan"],
    General: ["Complete Blood Count (CBC)","Basic Metabolic Panel (BMP)","Comprehensive Metabolic Panel (CMP)","Lipid Panel","Thyroid Function (TSH)","HbA1c","Blood Glucose (Fasting)","Urinalysis","Liver Function Test (LFT)","Renal Function Test (RFT)","Chest X-Ray","ECG / EKG","HIV Test","HBsAg","Hepatitis C (Anti-HCV)","Dengue NS1 Antigen","Malaria Rapid Test","Widal Test","ESR","CRP (C-Reactive Protein)","Serum Electrolytes","Vitamin D","Vitamin B12","Iron Studies"],
    Gynecology: ["Pap Smear","Pregnancy Test (Beta-HCG)","Pelvic Ultrasound","CA-125","Hormone Panel (FSH/LH/E2)","Thyroid Function (TSH)","Complete Blood Count (CBC)","Urinalysis","STI Screen","DEXA Bone Density","Mammogram"],
    Pulmonology: ["Pulmonary Function Test (PFT)","Peak Flow Meter","Chest X-Ray","CT Scan Chest","Sputum Culture","ABG (Arterial Blood Gas)","Bronchoscopy","Allergy Panel","Sleep Study (Polysomnography)","D-Dimer","CRP (C-Reactive Protein)","Complete Blood Count (CBC)"],
    Gastroenterology: ["Liver Function Test (LFT)","Abdominal Ultrasound","CT Scan Abdomen","Colonoscopy","Upper GI Endoscopy","Stool Culture","Stool Routine","H. Pylori Test","CA 19-9","CEA","Comprehensive Metabolic Panel (CMP)","Amylase","Lipase"],
    Endocrinology: ["HbA1c","Blood Glucose (Fasting)","Thyroid Function (TSH)","Thyroid Panel (T3/T4)","Cortisol","ACTH","Insulin Level","Vitamin D","Calcium","Parathyroid Hormone (PTH)","Bone Density (DEXA)","Complete Blood Count (CBC)","Lipid Panel"],
    Nephrology: ["Renal Function Test (RFT)","Urinalysis","Urine Culture","Urine Protein/Creatinine","Serum Electrolytes","Comprehensive Metabolic Panel (CMP)","Renal Ultrasound","24-hr Urine Protein","PT / INR","Complete Blood Count (CBC)"],
    Dermatology: ["Skin Biopsy","Patch Test","KOH Preparation","Tzanck Smear","VDRL / RPR","HIV Test","Complete Blood Count (CBC)","ANA (Antinuclear Antibody)","Allergy Panel","Fungal Culture"],
    Psychiatry: ["Thyroid Function (TSH)","Complete Blood Count (CBC)","Basic Metabolic Panel (BMP)","Vitamin D","Vitamin B12","Serum Cortisol","Drug Screen","Lithium Level","Valproate Level","EEG"],
    Ophthalmology: ["Visual Acuity Test","Tonometry (IOP)","Fundus Photography","OCT Scan","Visual Field Test","Slit Lamp Examination","Fluorescein Angiography","Blood Glucose (Fasting)","HbA1c","Blood Pressure Monitoring"],
    ENT: ["Audiometry","Tympanometry","Nasal Endoscopy","CT Scan Head","MRI Head","Thyroid Ultrasound","Throat Culture","Allergy Panel","Complete Blood Count (CBC)"],
    Urology: ["Urinalysis","Urine Culture","PSA (Prostate)","Renal Ultrasound","CT Urography","Cystoscopy","Renal Function Test (RFT)","Serum Electrolytes","Complete Blood Count (CBC)"],
  };

  const DEPT_MEDICINES: Record<string, string[]> = {
    Cardiology: [
      "Aspirin", "Clopidogrel", "Atorvastatin", "Rosuvastatin", "Metoprolol", "Atenolol", "Amlodipine", 
      "Lisinopril", "Ramipril", "Losartan", "Furosemide", "Spironolactone", "Warfarin", "Rivaroxaban", 
      "Apixaban", "Nitroglycerin", "Isosorbide Mononitrate", "Digoxin", "Amiodarone", "Bisoprolol", 
      "Carvedilol", "Enalapril", "Valsartan", "Sacubitril-Valsartan", "Diltiazem", "Verapamil", 
      "Nifedipine", "Hydralazine", "Lovastatin", "Pravastatin", "Simvastatin", "Fenofibrate", 
      "Gemfibrozil", "Ezetimibe", "Dabigatran", "Heparin", "Enoxaparin", "Dobutamine", "Dopamine", 
      "Epinephrine", "Norepinephrine", "Milrinone", "Nitroprusside", "Alteplase"
    ],
    Neurology: [
      "Levetiracetam", "Phenytoin", "Valproate", "Carbamazepine", "Lamotrigine", "Gabapentin", 
      "Pregabalin", "Donepezil", "Memantine", "Sumatriptan", "Topiramate", "Baclofen", "Clonazepam", 
      "Propranolol", "Amitriptyline", "Duloxetine", "Methylphenidate", "Modafinil", "Oxcarbazepine", 
      "Zonisamide", "Lacosamide", "Primidone", "Phenobarbital", "Levodopa-Carbidopa", "Pramipexole", 
      "Ropinirole", "Entacapone", "Selegiline", "Rasagiline", "Amantadine", "Galantamine", 
      "Rivastigmine", "Rizatriptan", "Zolmitriptan", "Eletriptan", "Galcanezumab", "Erenumab", 
      "Pyridostigmine", "Tizanidine", "Dantrolene", "Copaxone", "Fingolimod", "Ocrelizumab", "Interferon beta-1a"
    ],
    Pediatrics: [
      "Amoxicillin", "Paracetamol", "Ibuprofen", "Azithromycin", "Cetirizine", "Salbutamol", 
      "ORS Sachets", "Zinc Supplement", "Vitamin A", "Iron Supplement", "Metronidazole", 
      "Ondansetron", "Prednisolone", "Fluticasone Inhaler", "Amoxicillin-Clavulanate", "Cefdinir", 
      "Cephalexin", "Cefadroxil", "Claritin (Loratadine)", "Zyrtec (Cetirizine)", "Singulair (Montelukast)", 
      "Budesonide Nebulizer", "Salbutamol Nebulizer", "Mupirocin Ointment", "Nystatin Drops", 
      "Permethrin Cream", "Hydrocortisone 1% Cream", "Loperamide", "Albendazole", "Mebendazole", 
      "Vitamin D3 Drops", "Multivitamin Drops", "Amoxicillin Drops", "Paracetamol Suspension", 
      "Ibuprofen Suspension", "Ondansetron Drops", "Glycerin Suppository", "Normal Saline Nasal Spray", "Dextromethorphan Syrup"
    ],
    Oncology: [
      "Ondansetron", "Dexamethasone", "Aprepitant", "Metoclopramide", "Filgrastim", "Erythropoietin", 
      "Morphine", "Fentanyl", "Tramadol", "Paracetamol", "Methotrexate", "Leucovorin", "Tamoxifen", 
      "Letrozole", "Imatinib", "Capecitabine", "Paclitaxel", "Docetaxel", "Doxorubicin", "Cisplatin", 
      "Carboplatin", "Oxaliplatin", "5-Fluorouracil", "Cyclophosphamide", "Vincristine", "Vinblastine", 
      "Etoposide", "Gemcitabine", "Irinotecan", "Pemetrexed", "Anastrozole", "Exemestane", 
      "Bicalutamide", "Flutamide", "Leuprolide", "Goserelin", "Rituximab", "Trastuzumab", 
      "Bevacizumab", "Pembrolizumab", "Nivolumab", "Pegfilgrastim", "Loperamide", "Prochlorperazine"
    ],
    Orthopedics: [
      "Ibuprofen", "Diclofenac", "Naproxen", "Celecoxib", "Paracetamol", "Tramadol", "Morphine", 
      "Calcium + Vitamin D3", "Alendronate", "Zoledronic Acid", "Methocarbamol", "Baclofen", 
      "Colchicine", "Allopurinol", "Methotrexate", "Sulfasalazine", "Hydroxychloroquine", "Eterocoxib", 
      "Meloxicam", "Indomethacin", "Ketorolac", "Cyclobenzaprine", "Tizanidine", "Carisoprodol", 
      "Methylprednisolone", "Triamcinolone Injection", "Glucosamine", "Chondroitin", "Calcitriol", 
      "Risedronate", "Ibandronate", "Teriparatide", "Denosumab", "Gabapentin", "Pregabalin", 
      "Leflunomide", "Etanercept", "Adalimumab"
    ],
    General: [
      "Amoxicillin", "Azithromycin", "Ciprofloxacin", "Metronidazole", "Paracetamol", "Ibuprofen", 
      "Omeprazole", "Pantoprazole", "Cetirizine", "Loratadine", "Salbutamol", "Prednisolone", 
      "Metformin", "Atorvastatin", "Amlodipine", "Losartan", "Metoprolol", "ORS", "Zinc", 
      "Vitamin C", "Vitamin D3", "Cephalexin", "Doxycycline", "Amoxicillin-Clavulanate", 
      "Clindamycin", "Levofloxacin", "Ranitidine", "Famotidine", "Esomeprazole", "Rabeprazole", 
      "Domperidone", "Loperamide", "Bismuth Subsalicylate", "Fexofenadine", "Montelukast", 
      "Fluticasone Nasal Spray", "Hydrocortisone Cream", "Clotrimazole Cream", "Mupirocin Ointment", 
      "Silver Sulfadiazine", "Multivitamin", "B-Complex", "Calcium", "Iron"
    ],
    Gynecology: [
      "Folic Acid", "Iron Supplement", "Progesterone", "Estradiol", "Mefenamic Acid", "Tranexamic Acid", 
      "Fluconazole", "Metronidazole", "Clotrimazole", "Utrogestan", "Oxytocin", "Misoprostol", 
      "Dydrogesterone", "Letrozole", "Clomiphene", "Medroxyprogesterone", "Ethinyl Estradiol-Levonorgestrel", 
      "Norethindrone", "Norgestimate", "Desogestrel", "Levonorgestrel (Emergency Contraceptive)", 
      "Terconazole", "Miconazole Vaginal Cream", "Clindamycin Vaginal Cream", "Doxylamine-Pyridoxine (Diclegis)", 
      "Metoclopramide", "Ondansetron", "Calcium Carbonate", "Prenatal Vitamin", "Methylergonovine", 
      "Dinoprostone", "Magnesium Sulfate", "Nifedipine", "Terbutaline", "Betamethasone", "Cabergoline", "Bromocriptine"
    ],
    Pulmonology: [
      "Salbutamol Inhaler", "Ipratropium Inhaler", "Fluticasone Inhaler", "Budesonide Inhaler", 
      "Montelukast", "Prednisolone", "Doxycycline", "Azithromycin", "Amoxicillin-Clavulanate", 
      "Acetylcysteine", "Tiotropium", "Salmeterol", "Theophylline", "Albuterol Nebulizer", 
      "Levosalbutamol Inhaler", "Formoterol-Budesonide Inhaler", "Salmeterol-Fluticasone Inhaler", 
      "Umeclidinium-Vilanterol", "Glycopyrrolate Inhaler", "Aminophylline", "Methylprednisolone", 
      "Prednisone", "Cefuroxime", "Levofloxacin", "Moxifloxacin", "Pirfenidone", "Nintedanib", 
      "Codeine Syrup", "Dextromethorphan Syrup", "Guafenesin Syrup"
    ],
    Gastroenterology: [
      "Omeprazole", "Pantoprazole", "Esomeprazole", "Rabeprazole", "Domperidone", "Metoclopramide", 
      "Ondansetron", "Metronidazole", "Clarithromycin", "Amoxicillin", "Ursodeoxycholic Acid", 
      "Rifaximin", "Lactulose", "Mesalazine", "Azathioprine", "Lansoprazole", "Famotidine", 
      "Ranitidine", "Dicyclomine", "Hyoscyamine", "Mebeverine", "Loperamide", "Diphenoxylate-Atropine", 
      "Psyllium Husk", "Polyethylene Glycol (PEG)", "Bisacodyl", "Senna", "Sucralfate", 
      "Bismuth Subsalicylate", "Mesalamine", "Sulfasalazine", "Budesonide (EC)", "Infliximab", 
      "Adalimumab", "Pancreatin", "Spironolactone", "Propranolol"
    ],
    Endocrinology: [
      "Metformin", "Glipizide", "Glibenclamide", "Sitagliptin", "Empagliflozin", "Insulin Glargine", 
      "Insulin Regular", "Levothyroxine", "Methimazole", "Propylthiouracil", "Hydrocortisone", 
      "Desmopressin", "Vitamin D3", "Calcium Carbonate", "Alendronate", "Glimepiride", "Pioglitazone", 
      "Dapagliflozin", "Canagliflozin", "Liraglutide", "Semaglutide (Ozempic)", "Dulaglutide", 
      "Insulin Lispro", "Insulin Aspart", "Insulin NPH", "Liothyronine (T3)", "Fludrocortisone", 
      "Dexamethasone", "Prednisone", "Spironolactone", "Bromocriptine", "Cabergoline", "Octreotide", 
      "Raloxifene", "Teriparatide", "Denosumab"
    ],
    Nephrology: [
      "Furosemide", "Spironolactone", "Amlodipine", "Lisinopril", "Losartan", "Erythropoietin", 
      "Sodium Bicarbonate", "Calcium Carbonate", "Sevelamer", "Calcitriol", "Darbepoetin", 
      "Tacrolimus", "Mycophenolate", "Prednisolone", "Torsemide", "Bumetanide", "Metolazone", 
      "Hydralazine", "Minoxidil", "Clonidine", "Carvedilol", "Valsartan", "Sacubitril-Valsartan", 
      "Doxazosin", "Pravastatin", "Atorvastatin", "Ferrous Sulfate", "Iron Sucrose Injection", 
      "Calcium Acetate", "Lanthanum Carbonate", "Velphoro", "Cyclosporine", "Azathioprine", "Rituximab"
    ],
    Dermatology: [
      "Cetirizine", "Loratadine", "Hydrocortisone Cream", "Betamethasone Cream", "Clotrimazole Cream", 
      "Mupirocin Ointment", "Tretinoin Cream", "Acyclovir", "Fluconazole", "Doxycycline", 
      "Isotretinoin", "Permethrin", "Calamine Lotion", "Desonide Cream", "Clobetasol Propionate Cream", 
      "Triamcinolone Cream", "Tacrolimus Ointment", "Pimecrolimus Cream", "Ketoconazole Shampoo", 
      "Terbinafine Cream", "Erythromycin Gel", "Clindamycin Gel", "Benzoyl Peroxide", "Adapalene Gel", 
      "Salicylic Acid Ointment", "Minoxidil Topical", "Valacyclovir", "Ivermectin Cream", 
      "Tacrolimus Topical", "Methotrexate", "Acitretin", "Cyclosporine"
    ],
    Psychiatry: [
      "Sertraline", "Escitalopram", "Fluoxetine", "Amitriptyline", "Duloxetine", "Venlafaxine", 
      "Lithium", "Valproate", "Olanzapine", "Risperidone", "Quetiapine", "Clonazepam", "Lorazepam", 
      "Zolpidem", "Methylphenidate", "Aripiprazole", "Citalopram", "Paroxetine", "Fluvoxamine", 
      "Mirtazapine", "Bupropion", "Trazodone", "Haloperidol", "Fluphenazine", "Ziprasidone", 
      "Lurasidone", "Cariprazine", "Clozapine", "Lamotrigine", "Carbamazepine", "Diazepam", 
      "Alprazolam", "Temazepam", "Buspirone", "Hydroxyzine", "Atomoxetine", "Lisdexamfetamine", "Guanfacine"
    ],
    Ophthalmology: [
      "Timolol Eye Drops", "Latanoprost Eye Drops", "Tobramycin Eye Drops", "Dexamethasone Eye Drops", 
      "Ciprofloxacin Eye Drops", "Artificial Tears", "Ketorolac Eye Drops", "Cyclopentolate Eye Drops", 
      "Prednisolone Eye Drops", "Brimonidine Eye Drops", "Dorzolamide Eye Drops", "Bimatoprost Eye Drops", 
      "Travoprost Eye Drops", "Pilocarpine Eye Drops", "Moxifloxacin Eye Drops", "Gatifloxacin Eye Drops", 
      "Ofloxacin Eye Drops", "Erythromycin Eye Ointment", "Gentamicin Eye Drops", "Olopatadine Eye Drops", 
      "Ketotifen Eye Drops", "Cyclosporine Eye Drops (Restasis)", "Flurbiprofen Eye Drops", 
      "Diclofenac Eye Drops", "Atropine Eye Drops", "Phenylephrine Eye Drops"
    ],
    ENT: [
      "Amoxicillin", "Azithromycin", "Cetirizine", "Oxymetazoline Nasal Spray", "Budesonide Nasal Spray", 
      "Fluticasone Nasal Spray", "Ciprofloxacin Ear Drops", "Betahistine", "Mometasone", "Prednisolone", 
      "Amoxicillin-Clavulanate", "Cefuroxime", "Clindamycin", "Fexofenadine", "Levocetirizine", 
      "Montelukast", "Triamcinolone Nasal Spray", "Azelastine Nasal Spray", "Saline Nasal Spray", 
      "Ofloxacin Ear Drops", "Neomycin-Polymyxin-HC Ear Drops", "Clotrimazole Ear Drops", 
      "Carbamide Peroxide (Earwax Softener)", "Lidocaine Lozenges", "Chlorhexidine Mouthwash", 
      "Nystatin Oral Suspension", "Meclizine", "Dimenhydrinate"
    ],
    Urology: [
      "Tamsulosin", "Finasteride", "Sildenafil", "Tadalafil", "Oxybutynin", "Solifenacin", 
      "Nitrofurantoin", "Ciprofloxacin", "Trimethoprim", "Phenazopyridine", "Dutasteride", 
      "Silodosin", "Alfuzosin", "Doxazosin", "Terazosin", "Betechole (Bethanechol)", "Mirabegron", 
      "Tolterodine", "Darifenacin", "Trospium", "Trimethoprim-Sulfamethoxazole", "Fosfomycin", 
      "Levofloxacin", "Cephalexin", "Alopurinol", "Potassium Citrate", "Leuprolide", "Goserelin", 
      "Degarelix", "Abiraterone", "Enzalutamide"
    ],
  };

  function getDeptTests(): string[] {
    const dept = user?.department?.trim() || "";
    const key = Object.keys(DEPT_TESTS).find(k => dept.toLowerCase().includes(k.toLowerCase()));
    return key ? DEPT_TESTS[key] : DEPT_TESTS["General"];
  }
  function getDeptMedicines(): string[] {
    const dept = (user?.department ?? "").trim().toLowerCase();
    const match = DEPT_ALIASES.find(({ keywords }) =>
      keywords.some(kw => dept.includes(kw))
    );
    const resolvedKey = match ? match.key : "General";
    const medicines = DEPT_MEDICINES[resolvedKey] ?? DEPT_MEDICINES["General"];
    return [...medicines].sort((a, b) => a.localeCompare(b));
  }
  function toggleFavMedicine(name: string) {
    const updated = favMedicines.includes(name)
      ? favMedicines.filter(f => f !== name)
      : [...favMedicines, name];
    setFavMedicines(updated);
    try { localStorage.setItem("favMedicines", JSON.stringify(updated)); } catch {}
  }

  const activeQueue: Patient[] = patients.filter((p) => p.status !== "completed");

  const filteredCompletedPatients: (Patient & { visitCode?: string })[] = [];
  const seenCompleted = new Set<string>();

  patients.forEach((p) => {
    if (p.status !== "completed") return;
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (statusFilter === "revisit" && !p.followUp) return;

    if (matchesSearch) {
      // Use a stable identity so the same completion doesn't get re-added
      const key = p.patientId || p.queueId || p.id || p.name;
      if (!seenCompleted.has(key)) {
        seenCompleted.add(key);


        const deptChar = (p.department || "G").trim().charAt(0).toUpperCase();
        let doc = (p.doctor || "D").trim();
        if (doc.toLowerCase().startsWith("dr.")) {
          doc = doc.substring(3).trim();
        }
        const docChar = doc.charAt(0).toUpperCase();
        const count = p.visitCount || (p.pastVisits?.length || 0) + 1;
        const seq = String(count).padStart(3, "0");
        const visitCode = `${deptChar}${docChar}${seq}`;

        filteredCompletedPatients.push({
          ...p,
          visitCode,
        });
      }
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingSchedules = patients
    .filter((p) => {
      if (!p.followUp) return false;
      const followUpDate = new Date(p.followUp);
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate >= today;
    })
    .sort((a, b) => new Date(a.followUp!).getTime() - new Date(b.followUp!).getTime());

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between transition-all duration-300 ${sidebarOpen ? "w-72 p-6" : "w-14 p-2"}`}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* Collapse toggle */}
          <div className={`flex ${sidebarOpen ? "justify-between items-center" : "justify-center"} mb-5`}>
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-sky-500/20 shrink-0">
                  H
                </div>
                <div>
                  <h2 className="font-extrabold text-base leading-tight tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400">
                    Lumina Health
                  </h2>
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Hospital System
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg className={`w-4 h-4 text-zinc-500 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {sidebarOpen && (
            <>
              {/* User badge */}
              <div className="mb-5 p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Active Session</p>
                <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{user.fullName}</h4>
                <span className="inline-block mt-2 px-2 py-0.5 text-xs font-bold uppercase rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200/40 dark:border-sky-800/40">
                  {user.role}
                </span>
                {user.department && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">{user.department}</p>
                )}
              </div>

              {/* Stats counters */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: "Total",    value: patients.length,                                      color: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300"          },
                  { label: "Pending",  value: patients.filter(p => p.status === "pending").length,   color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"   },
                  { label: "Treating", value: patients.filter(p => p.status === "treating").length,  color: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"},
                  { label: "Done",     value: patients.filter(p => p.status === "completed").length, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"},
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-3 ${s.color}`}>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">{s.label}</p>
                    <p className="text-2xl font-black mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Queue list */}
              <div className="mb-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 px-1">
                  Queue · {patients.filter(p => p.status !== "completed").length} waiting
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {patients.filter(p => p.status !== "completed").length === 0 ? (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic px-1">No active patients</p>
                  ) : patients.filter(p => p.status !== "completed").map(p => (
                    <button key={p.id} onClick={() => { setActivePatient(p); setIsExamining(true); setActiveTab("overview"); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
                        activePatient?.id === p.id
                          ? "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold"
                          : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{p.name}</span>
                        <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                          p.status === "treating" ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" : "bg-amber-100 dark:bg-amber-950/30 text-amber-700"
                        }`}>{p.status === "treating" ? "In Prog" : "Waiting"}</span>
                      </div>
                      <p className="text-zinc-400 dark:text-zinc-500 text-[10px] mt-0.5">{p.age} y/o · {p.time}</p>
                      {p.allergies && p.allergies.length > 0 && (
                        <span className="inline-block mt-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">⚠ Allergy</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </>
          )}

          {/* Nav menu */}
          <nav className="space-y-1.5">
            {[
              {
                id: "overview" as const,
                label: "Overview",
                icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z",
              },
              {
                id: "patients" as const,
                label: "Completed Patients",
                icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
                badge: patients.filter(p => p.status === "completed").length,
              },
              {
                id: "schedule" as const,
                label: "Schedule",
                icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
              },
            ].map(item => (
              <button key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-left transition-all ${
                  activeTab === item.id
                    ? "bg-gradient-to-r from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-transparent text-sky-600 dark:text-sky-400"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60"
                } ${!sidebarOpen ? "justify-center" : ""}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {"badge" in item && item.badge! > 0 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <button
          onClick={handleLogout}
          title={!sidebarOpen ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-200 transition-all mt-3 ${!sidebarOpen ? "justify-center" : ""}`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {sidebarOpen && <span>Logout Session</span>}
        </button>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto p-10">
        {/* Header */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-50 dark:to-zinc-300 bg-clip-text text-transparent">
              {isDoctor ? `Dr. ${user.fullName.split(" ")[0]}'s Consultation Office` : "Patient Care Reception Desk"}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">
              Today is {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-full">
              System Online
            </span>
          </div>
        </header>

        {isDoctor ? (
          <>
            {/* DOCTOR DASHBOARD */}
            {activeTab === "overview" && !activePatient && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left 2 Columns */}
                <div className="xl:col-span-2 space-y-8">
                  {/* Consultation queue list card */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                          Consultation Schedule & Worklist
                        </h3>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                          {"Manage today's consultations, update vitals, and write prescriptions."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                      {activeQueue.length > 0 ? (
                        activeQueue.map((patient) => {
                          const isActive = (activePatient as Patient | null)?.id === patient.id;
                          return (
                            <div
                              key={patient.id}
                              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-sky-500/30 ${
                                isActive
                                  ? "bg-sky-50/40 dark:bg-sky-950/20 border-sky-500 shadow-sm"
                                  : "bg-transparent border-zinc-200 dark:border-zinc-800"
                              }`}
                              onClick={() => { setActivePatient(patient); setIsExamining(true); }}
                            >
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-zinc-800 dark:to-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-center font-extrabold text-indigo-600 dark:text-indigo-400">
                                  {patient.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-extrabold text-base text-zinc-800 dark:text-zinc-200">{patient.name}</h4>
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-bold text-zinc-500 dark:text-zinc-400">
                                      {patient.patientId || patient.id}
                                    </span>
                                    {patient.visitType && patient.visitType !== "new" && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                        patient.visitType === "revisit" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                                      }`}>{patient.visitType === "revisit" ? "🔁 Revisit" : "📋 Follow-up"}</span>
                                    )}
                                    {patient.allergies && patient.allergies.length > 0 && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-100 text-rose-700 animate-pulse">
                                        ⚠ Allergy
                                      </span>
                                    )}
                                    {patient.pastVisits && patient.pastVisits.length > 0 && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-sky-100 text-sky-700">
                                        {patient.pastVisits.length} past visit{patient.pastVisits.length > 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-1">
                                      {patient.age ? `${patient.age} y/o` : '—'} • {patient.gender || 'unknown'} • Checked in at {patient.time}
                                  </p>
                                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-1">
                                    <span className="text-zinc-400 dark:text-zinc-600 font-bold uppercase text-[10px] tracking-wider mr-1">Reason:</span>
                                    {patient.reason}
                                  </p>
                                  {patient.followUp && (
                                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase">
                                      Revisit {new Date(patient.followUp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-end md:self-center">
                                <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                                  patient.status === "completed"
                                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                    : patient.status === "treating"
                                    ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                                }`}>
                                  {patient.status === "treating" ? "In Progress" : patient.status}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActivePatient(patient); setIsExamining(true); }}
                                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600/90 dark:hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-500/10"
                                >
                                  Examine Patient
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-10 bg-slate-50 dark:bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                          <p className="text-zinc-400 font-medium">No active patients in queue.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weekly Chart */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                          Weekly Consultations Volume
                        </h3>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          Visualization of total checked-in patients vs treated cases.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-sky-500 bg-sky-100/50 dark:bg-sky-950/30 px-3 py-1 rounded-full">
                        Last 5 Days
                      </span>
                    </div>

                    <div className="h-44 w-full flex items-end justify-between px-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      {[
                        { day: "Mon", count: 12, height: "h-[65%]" },
                        { day: "Tue", count: 15, height: "h-[85%]" },
                        { day: "Wed", count: 8,  height: "h-[45%]" },
                        { day: "Thu", count: 18, height: "h-[100%]" },
                        { day: "Fri", count: 14, height: "h-[75%]" },
                      ].map((bar, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 max-w-[50px]">
                          <span className="text-[10px] font-extrabold text-zinc-400">{bar.count}</span>
                          <div className={`${bar.height} w-7 bg-gradient-to-t from-sky-500 to-indigo-600 rounded-t-lg transition-all duration-500 hover:opacity-90`}></div>
                          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1">{bar.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: empty placeholder */}
                <div className="xl:col-span-1">
                  <div className="h-full bg-slate-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center flex flex-col justify-center items-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-black mb-4">
                      Rx
                    </div>
                    <h4 className="font-extrabold text-lg text-zinc-800 dark:text-zinc-200">No Patient Selected</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 max-w-[240px] leading-relaxed">
                      {"Click \"Examine Patient\" on any item in your list to open the full EHR panel."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Full-Width EHR Examination Panel */}
            {activePatient && activeTab === "overview" && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden mt-8">
                {/* Panel Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-sky-50/60 to-indigo-50/40 dark:from-sky-950/20 dark:to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-sky-500/20">
                      {activePatient.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100">{activePatient.name}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{activePatient.patientId || activePatient.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          activePatient.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          activePatient.status === "treating"  ? "bg-indigo-100 text-indigo-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{activePatient.status}</span>
                        {activePatient.visitType && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            activePatient.visitType === "revisit"  ? "bg-orange-100 text-orange-700" :
                            activePatient.visitType === "followup" ? "bg-purple-100 text-purple-700" :
                            "bg-sky-100 text-sky-700"
                          }`}>
                            {activePatient.visitType === "revisit"  ? "🔁 Revisit" :
                             activePatient.visitType === "followup" ? "📋 Follow-up" :
                             "👤 New Visit"}
                          </span>
                        )}
                        {activePatient.allergies && activePatient.allergies.length > 0 && (
                          <div
                            className="relative"
                            onMouseEnter={() => setShowAlertPopup(true)}
                            onMouseLeave={() => setShowAlertPopup(false)}
                          >
                            <button
                              type="button"
                              onClick={() => setShowAlertPopup(v => !v)}
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors animate-pulse"
                            >
                              ⚠️ Allergy Note
                            </button>

                            {showAlertPopup && (
                              <div className="absolute left-0 top-full mt-2 w-64 z-30 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800/50 shadow-xl shadow-rose-500/10 p-4">
                                <div className="flex items-start gap-2.5">
                                  <span className="text-lg shrink-0">⚠️</span>
                                  <div>
                                    <p className="text-xs font-extrabold text-rose-700 dark:text-rose-300">
                                      Allergy / Sensitivity Alert
                                    </p>
                                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                                      Flagged from clinical notes
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {activePatient.allergies.map(a => (
                                        <span
                                          key={a}
                                          className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 capitalize"
                                        >
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                {/* little arrow pointing up to the button */}
                                <div className="absolute -top-1.5 left-5 w-3 h-3 bg-white dark:bg-zinc-900 border-l border-t border-rose-200 dark:border-rose-800/50 rotate-45" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-semibold">
                        {activePatient.age} yrs • {activePatient.gender} • Check-in {activePatient.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {activePatient.status === "completed" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowAlertPopup(v => !v)}
                          disabled={!activePatient.allergies || activePatient.allergies.length === 0}
                          className="px-3 py-2 bg-rose-100 hover:bg-rose-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-extrabold transition-all border border-rose-200 dark:border-rose-800/50"
                          title={activePatient.allergies?.length ? "View allergy note" : "No allergies"}
                        >
                          ⚠ Allergy
                        </button>
                        <button
                          onClick={downloadPrescriptionPdf}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-500/15 flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          Download Report
                        </button>
                        <button
                          onClick={() => setActivePatient(null)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
                          title="Close panel"
                        >
                          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={savePatientClinicalNotes}
                          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          Save Draft
                        </button>
                        <button
                          onClick={downloadPrescriptionPdf}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          Download Rx
                        </button>
                        <button
                          onClick={() => { savePatientClinicalNotes().then(() => completeConsultation()); }}
                          className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-sky-500/15 flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Finalize & Close
                        </button>
                        <button
                          onClick={() => setActivePatient(null)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
                          title="Close panel"
                        >
                          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-8">
                  {/* EHR inner tab bar */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800/60 rounded-2xl w-fit mb-6">
                    {([
                      { id: "notes",   label: "Clinical Notes",   icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                      { id: "history", label: `Visit History${activePatient.pastVisits && activePatient.pastVisits.length > 0 ? ` (${activePatient.pastVisits.length})` : ""}`, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setEhrTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          ehrTab === t.id
                            ? "bg-white dark:bg-zinc-900 shadow text-sky-600 dark:text-sky-400"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                        </svg>
                        {t.label}
                        {t.id === "history" && activePatient.pastVisits === undefined && (
                          <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Allergy alert */}
                  {activePatient.allergies && activePatient.allergies.length > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 mb-6">
                      <span className="text-xl shrink-0">⚠️</span>
                      <div>
                        <p className="text-sm font-extrabold text-rose-700 dark:text-rose-300">Allergy / Sensitivity Alert</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {activePatient.allergies.map(a => (
                            <span key={a} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 capitalize">{a}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HISTORY TAB */}
                  {ehrTab === "history" && (
                    <div className="space-y-4">
                      {activePatient.pastVisits === undefined && (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                          <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
                          <p className="text-sm font-medium">Loading visit history…</p>
                        </div>
                      )}
                      {activePatient.pastVisits && activePatient.pastVisits.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-medium">No previous visits found</p>
                          <p className="text-xs mt-1 text-zinc-400">{"This appears to be the patient's first visit"}</p>
                        </div>
                      )}
                      {activePatient.pastVisits && activePatient.pastVisits.map((v, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                          <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-sky-50 to-indigo-50/40 dark:from-sky-950/20 dark:to-transparent border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-sky-700 dark:text-sky-300">
                                Visit {activePatient.pastVisits!.length - i}
                              </span>
                              <span className="text-zinc-300 dark:text-zinc-600">·</span>
                              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                {new Date(v.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              {v.visitType && v.visitType !== "new" && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  v.visitType === "revisit" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                                }`}>{v.visitType === "revisit" ? "🔁 Revisit" : "📋 Follow-up"}</span>
                              )}
                            </div>
                            {v.doctor && (
                              <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">Dr. {v.doctor}</span>
                            )}
                          </div>

                          <div className="p-5 space-y-4">
                            {!!(v.bloodPressure || (v.heartRate && v.heartRate > 0) || (v.temperature && v.temperature > 0)) && (
                              <div className="flex flex-wrap gap-2">
                                {v.bloodPressure && (
                                  <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl px-3 py-2">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-400">BP</span>
                                    <span className="text-sm font-black text-rose-700 dark:text-rose-300">{v.bloodPressure}</span>
                                    <span className="text-[9px] text-rose-400">mmHg</span>
                                  </div>
                                )}
                                {v.heartRate && v.heartRate > 0 && (
                                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-3 py-2">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400">HR</span>
                                    <span className="text-sm font-black text-amber-700 dark:text-amber-300">{v.heartRate}</span>
                                    <span className="text-[9px] text-amber-400">bpm</span>
                                  </div>
                                )}
                                {v.temperature && v.temperature > 0 && (
                                  <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl px-3 py-2">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-orange-400">Temp</span>
                                    <span className="text-sm font-black text-orange-700 dark:text-orange-300">{v.temperature}°F</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {v.diagnosis && (
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Primary Diagnosis</p>
                                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{v.diagnosis}</p>
                                </div>
                              )}
                              {v.chiefComplaint && (
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Chief Complaint</p>
                                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{v.chiefComplaint}</p>
                                </div>
                              )}
                            </div>

                            {v.symptoms && (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Symptoms</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">{v.symptoms}</p>
                              </div>
                            )}

                            {v.medications.length > 0 && (
                              <div>
                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Medications (Rx)</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {v.medications.map((m, mi) => (
                                    <span key={mi} className="text-[11px] font-semibold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30">{m}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {v.tests.length > 0 && (
                              <div>
                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Tests / Investigations</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {v.tests.map((t, ti) => (
                                    <span key={ti} className="text-[11px] font-semibold px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/30">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {v.notes && (
                              <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20">
                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 mb-1">{"Doctor's Notes"}</p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{v.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* NOTES TAB */}
                  {ehrTab === "notes" && activePatient.status !== "completed" && (
                    <div className="space-y-8">
                      {/* Vitals Row — dynamically rendered per department */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Diagnostic Vitals</h4>
                          {user?.department && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                              {user.department} Profile
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                          {/* Department-specific vital inputs */}
                          {getDeptVitals().map((vf) => {
                            const colorParts = vf.color.split(" ");
                            const labelColor = colorParts.filter(c => c.startsWith("text-")).join(" ");
                            const bgBorder   = colorParts.filter(c => !c.startsWith("text-")).join(" ");
                            const status     = getVitalStatus(vf.key);
                            // Override card border when out of range
                            const outlineCls = status === "high"
                              ? "ring-1 ring-red-300 dark:ring-red-700"
                              : status === "low"
                              ? "ring-1 ring-blue-300 dark:ring-blue-700"
                              : "";

                            const val = getVitalValue(vf.key);
                            const isEmpty = val === "" || val === null || val === undefined;

                            return (
                              <div key={vf.key} className={`p-4 border rounded-2xl transition-all ${bgBorder} ${outlineCls}`}>
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="min-w-0">
                                    <span className={`text-[10px] font-bold ${labelColor}`}>{vf.label}</span>
                                    {/* optimal range text next to indicator */}
                                    <div className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
                                      {vf.key === "weight" ? "Optimal: 50–100 kg" :
                                      vf.key === "height" ? "Optimal: 120–200 cm" : ""}
                                    </div>
                                  </div>
                                  <VitalIndicator status={status} />
                                </div>
                                <input
                                  type={vf.inputType}
                                  step={vf.step}
                                  value={isEmpty ? "" : val}
                                  onChange={(e) => setVitalValue(vf.key, e.target.value)}
                                  placeholder=""
                                  className="w-full bg-transparent border-0 p-0 text-base font-black focus:outline-none text-zinc-800 dark:text-zinc-100"
                                />
                                <span className="text-[10px] text-zinc-400">{vf.unit}</span>
                              </div>
                            );
                          })}
                          {/* Static demographic cards */}
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1">Age</span>
                            <p className="text-base font-black text-zinc-800 dark:text-zinc-100">{activePatient.age}</p>
                            <span className="text-[10px] text-zinc-400">years</span>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1">Gender</span>
                            <p className="text-base font-black text-zinc-800 dark:text-zinc-100">{activePatient.gender}</p>
                            <span className="text-[10px] text-zinc-400">biological</span>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1">Follow-up Date</span>
                            <input type="date" value={editFollowUp} onChange={(e) => setEditFollowUp(e.target.value)}
                              className="w-full bg-transparent border-0 p-0 text-xs font-black focus:outline-none text-zinc-800 dark:text-zinc-100" />
                          </div>
                        </div>
                      </section>

                      {/* Clinical Notes */}
                      <section>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">Clinical Assessment</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider mb-2 block">Chief Complaint</label>
                            <input type="text" value={editChiefComplaint} onChange={(e) => setEditChiefComplaint(e.target.value)}
                              placeholder="Primary reason for visit in patient's own words"
                              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider mb-2 block">Primary Diagnosis</label>
                            <input type="text" value={editPrimaryDiagnosis} onChange={(e) => setEditPrimaryDiagnosis(e.target.value)}
                              placeholder="Provisional diagnosis or clinical impression"
                              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider mb-2 block">Symptoms</label>
                            <textarea rows={3} value={editSymptoms} onChange={(e) => setEditSymptoms(e.target.value)}
                              placeholder="Duration, severity, onset, associated symptoms..."
                              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-sky-500 focus:outline-none placeholder-zinc-400 resize-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider mb-2 block">Progress Notes</label>
                            <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Exam findings, treatment plan, observations..."
                              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-sky-500 focus:outline-none placeholder-zinc-400 resize-none" />
                          </div>
                        </div>
                      </section>

                      {/* Investigations + Prescription */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Investigations */}
                        <section className="p-5 bg-slate-50 dark:bg-zinc-800/20 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Requested Investigations</h4>
                            {user?.department && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                                {user.department}
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={testSearchQuery}
                                  onChange={(e) => { setTestSearchQuery(e.target.value); setNewTestName(e.target.value); setTestSearchOpen(true); }}
                                  onFocus={() => setTestSearchOpen(true)}
                                  onBlur={() => setTimeout(() => setTestSearchOpen(false), 150)}
                                  placeholder="Search or type a test name..."
                                  className="w-full px-4 py-3 text-sm bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:outline-none focus:border-sky-500 placeholder-zinc-400 pr-9"
                                />
                                <svg className="w-4 h-4 absolute right-3 top-3.5 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {testSearchOpen && (
                                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl max-h-72 overflow-y-auto">
                                    {getDeptTests()
                                      .filter(t => t.toLowerCase().includes(testSearchQuery.toLowerCase()) && !editTests.includes(t))
                                      .map((t) => (
                                        <button key={t} type="button"
                                          onMouseDown={() => {
                                            const updated = [...editTests, t];
                                            setEditTests(updated);
                                            const up: Patient = { ...activePatient, tests: updated };
                                            setActivePatient(up);
                                            setPatients(patients.map(p => p.id === activePatient.id ? up : p));
                                            setTestSearchQuery(""); setNewTestName(""); setTestSearchOpen(false);
                                          }}
                                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0 font-medium text-zinc-700 dark:text-zinc-300"
                                        >{t}</button>
                                      ))}
                                    {testSearchQuery.trim() && !getDeptTests().some(t => t.toLowerCase() === testSearchQuery.trim().toLowerCase()) && (
                                      <button type="button"
                                        onMouseDown={() => {
                                          const t = testSearchQuery.trim();
                                          if (!t || editTests.includes(t)) return;
                                          const updated = [...editTests, t];
                                          setEditTests(updated);
                                          const up: Patient = { ...activePatient, tests: updated };
                                          setActivePatient(up);
                                          setPatients(patients.map(p => p.id === activePatient.id ? up : p));
                                          setTestSearchQuery(""); setNewTestName(""); setTestSearchOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-sky-50 dark:hover:bg-sky-950/20 font-bold text-sky-600 dark:text-sky-400"
                                      >+ Add &ldquo;{testSearchQuery.trim()}&rdquo;</button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button type="button"
                                onClick={() => {
                                  const t = testSearchQuery.trim() || newTestName.trim();
                                  if (!t || editTests.includes(t)) return;
                                  const updated = [...editTests, t];
                                  setEditTests(updated);
                                  const up: Patient = { ...activePatient, tests: updated };
                                  setActivePatient(up);
                                  setPatients(patients.map(p => p.id === activePatient.id ? up : p));
                                  setTestSearchQuery(""); setNewTestName("");
                                }}
                                className="px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-bold transition-colors shrink-0"
                              >Add</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 min-h-[36px]">
                            {editTests.length > 0 ? editTests.map((test, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-sm">
                                {test}
                                <button type="button" onClick={() => removeTest(idx)} className="text-zinc-400 hover:text-rose-500 transition-colors text-base leading-none">×</button>
                              </span>
                            )) : (
                              <p className="text-xs text-zinc-400 italic">No investigations added yet.</p>
                            )}
                          </div>
                        </section>

                        {/* Prescription */}
                        <section className="p-5 bg-slate-50 dark:bg-zinc-800/20 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Prescription (Rx)</h4>
                            {user?.department && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                {user.department}
                              </span>
                            )}
                          </div>

                          {favMedicines.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">★ Favourites</p>
                                <button type="button"
                                  onClick={() => { setFavMedicines([]); try { localStorage.removeItem("favMedicines"); } catch {} }}
                                  className="text-[10px] font-semibold text-zinc-400 hover:text-rose-500 transition-colors"
                                >Clear all</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {favMedicines.map(fav => (
                                  <button key={fav} type="button"
                                    onMouseDown={() => { setNewMedName(fav); setMedSearchQuery(fav); }}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors"
                                  >{fav}</button>
                                ))}
                              </div>
                            </div>
                          )}

                          <form onSubmit={addMedication} className="space-y-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={medSearchQuery}
                                onChange={(e) => { setMedSearchQuery(e.target.value); setNewMedName(e.target.value); setMedSearchOpen(true); }}
                                onFocus={() => setMedSearchOpen(true)}
                                onBlur={() => setTimeout(() => setMedSearchOpen(false), 150)}
                                placeholder="Search drug name..."
                                className="w-full px-4 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500 pr-9"
                              />
                              <svg className="w-3.5 h-3.5 absolute right-3 top-3 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              {medSearchOpen && (
                                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                                  {favMedicines.filter(f => f.toLowerCase().includes(medSearchQuery.toLowerCase())).length > 0 && (
                                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-500 border-b border-zinc-100 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/10">
                                      ★ Favourites
                                    </div>
                                  )}
                                  {favMedicines.filter(f => f.toLowerCase().includes(medSearchQuery.toLowerCase())).map(fav => (
                                    <button key={`fav-${fav}`} type="button"
                                      onMouseDown={() => { setNewMedName(fav); setMedSearchQuery(fav); setMedSearchOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/20 border-b border-zinc-100 dark:border-zinc-800 font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2"
                                    >
                                      <span className="text-amber-400">★</span>{fav}
                                    </button>
                                  ))}
                                  {getDeptMedicines().filter(m => m.toLowerCase().includes(medSearchQuery.toLowerCase()) && !favMedicines.includes(m)).length > 0 && (
                                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/30">
                                      {user?.department ?? 'Department'} Formulary
                                    </div>
                                  )}
                                  {getDeptMedicines()
                                    .filter(m => m.toLowerCase().includes(medSearchQuery.toLowerCase()) && !favMedicines.includes(m))
                                    .map(m => (
                                      <button key={m} type="button"
                                        onMouseDown={() => { setNewMedName(m); setMedSearchQuery(m); setMedSearchOpen(false); }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0 font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between group"
                                      >
                                        <span>{m}</span>
                                        <button type="button"
                                          onMouseDown={(e) => { e.stopPropagation(); toggleFavMedicine(m); }}
                                          className="text-zinc-300 group-hover:text-amber-400 hover:!text-amber-500 transition-colors text-sm leading-none"
                                          title="Add to favourites"
                                        >★</button>
                                      </button>
                                    ))}
                                  {medSearchQuery.trim() && !getDeptMedicines().some(m => m.toLowerCase() === medSearchQuery.trim().toLowerCase()) && (
                                    <button type="button"
                                      onMouseDown={() => { setNewMedName(medSearchQuery.trim()); setMedSearchOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-xs hover:bg-sky-50 dark:hover:bg-sky-950/20 font-bold text-sky-600 dark:text-sky-400"
                                    >+ Use &ldquo;{medSearchQuery.trim()}&rdquo;</button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 flex-wrap items-center">
                              <select
                                value={newMedDosage}
                                onChange={(e) => setNewMedDosage(e.target.value)}
                                className="px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500"
                                required
                              >
                                <option value="" disabled>Select dosage</option>
                                {dosageOptions.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="custom">Custom...</option>
                              </select>
                              {newMedDosage === "custom" && (
                                <input
                                  type="text"
                                  value={customDosage}
                                  onChange={(e) => setCustomDosage(e.target.value)}
                                  placeholder="Enter dosage"
                                  className="px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500"
                                  required
                                />
                              )}
                              <input type="text" value={newMedFreq} onChange={(e) => setNewMedFreq(e.target.value)}
                                placeholder="Frequency"
                                className="px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500" />
                              <input type="text" value={newMedDays} onChange={(e) => setNewMedDays(e.target.value)}
                                placeholder="Duration"
                                className="px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500" />
                            </div>
                            <div className="flex gap-2">
                              <input type="text" value={newMedRemarks} onChange={(e) => setNewMedRemarks(e.target.value)}
                                placeholder="Remarks (optional)"
                                className="flex-1 px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-sky-500" />
                              <button type="submit" className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                                </svg>
                                Add
                              </button>
                            </div>
                          </form>

                          <div className="space-y-2 max-h-[160px] overflow-y-auto">
                            {activePatient.medications.length > 0 ? (
                              activePatient.medications.map((med, idx) => (
                                <div key={idx} className="flex justify-between items-start p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl group">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <button type="button" onClick={() => toggleFavMedicine(med.name)}
                                      className={`mt-0.5 text-sm shrink-0 transition-colors ${favMedicines.includes(med.name) ? "text-amber-400" : "text-zinc-300 group-hover:text-zinc-400"}`}
                                      title={favMedicines.includes(med.name) ? "Remove from favourites" : "Add to favourites"}
                                    >★</button>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">{med.name}</p>
                                      <p className="text-[10px] text-zinc-400 font-bold mt-0.5">{med.dosage} • {med.frequency}{med.days ? ` • ${med.days}` : ""}</p>
                                      {med.remarks && <p className="text-[10px] text-zinc-500 italic mt-0.5">{med.remarks}</p>}
                                    </div>
                                  </div>
                                  <button onClick={() => removeMedication(idx)} className="p-1 text-zinc-400 hover:text-rose-500 transition-colors shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-zinc-400 italic text-center py-3">No medications prescribed yet.</p>
                            )}
                          </div>
                        </section>
                      </div>

                      {/* Bottom action bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <button onClick={() => setActivePatient(null)} className="px-5 py-2.5 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                          ← Back to List
                        </button>
                        <div className="flex gap-3">
                          <button onClick={savePatientClinicalNotes} className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-2xl text-sm font-bold transition-colors">
                            Save Draft
                          </button>
                          <button
                            onClick={downloadPrescriptionPdf}
                            className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-sm font-bold transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            Download Prescription
                          </button>
                          <button
                            onClick={() => { savePatientClinicalNotes().then(() => completeConsultation()); }}
                            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-sm font-extrabold transition-all shadow-md shadow-sky-500/15 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            Finalize Consultation
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NOTES TAB — READ ONLY SUMMARY (completed patients) */}
                  {ehrTab === "notes" && activePatient.status === "completed" && (
                    <div className="space-y-6">
                      {/* Vitals summary */}
                      <section>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                          Diagnostic Vitals
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                          {getDeptVitals(activePatient.department).map((vf) => {
                            const colorParts = vf.color.split(" ");
                            const labelColor = colorParts.filter(c => c.startsWith("text-")).join(" ");
                            const bgBorder   = colorParts.filter(c => !c.startsWith("text-")).join(" ");
                            const status     = getVitalStatus(vf.key);
                            const outlineCls = status === "high"
                              ? "ring-1 ring-red-300 dark:ring-red-700"
                              : status === "low"
                              ? "ring-1 ring-blue-300 dark:ring-blue-700"
                              : "";
                            const val        = getVitalValue(vf.key);
                            return (
                              <div key={vf.key} className={`p-4 border rounded-2xl transition-all ${bgBorder} ${outlineCls}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold ${labelColor}`}>{vf.label}</span>
                                  <VitalIndicator status={status} />
                                </div>
                                <p className="text-base font-black text-zinc-800 dark:text-zinc-100 leading-tight">
                                  {val || "—"}
                                </p>
                                <span className="text-[10px] text-zinc-400">{vf.unit}</span>
                              </div>
                            );
                          })}
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1">Age</span>
                            <p className="text-base font-black text-zinc-800 dark:text-zinc-100">{activePatient.age > 0 ? activePatient.age : "—"}</p>
                            <span className="text-[10px] text-zinc-400">years</span>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <span className="text-[10px] font-bold text-zinc-400 block mb-1">Gender</span>
                            <p className="text-base font-black text-zinc-800 dark:text-zinc-100">{activePatient.gender && activePatient.gender !== "Unknown" ? activePatient.gender : "—"}</p>
                          </div>
                        </div>
                      </section>

                      {/* Clinical summary */}
                      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Chief Complaint</p>
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{activePatient.chiefComplaint || "—"}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Primary Diagnosis</p>
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{activePatient.primaryDiagnosis || "—"}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl md:col-span-2">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Symptoms</p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{activePatient.symptoms || "—"}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl md:col-span-2">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Doctor&apos;s Notes</p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{activePatient.notes || "—"}</p>
                        </div>
                        {activePatient.tests && activePatient.tests.length > 0 && (
                          <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl md:col-span-2">
                            <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Tests Ordered</p>
                            <div className="flex flex-wrap gap-1.5">
                              {activePatient.tests.map(t => (
                                <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Medications summary */}
                      <section>
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Prescribed Medications</p>
                        <div className="space-y-2">
                          {activePatient.medications.length > 0 ? (
                            activePatient.medications.map((med, idx) => (
                              <div key={idx} className="flex justify-between items-start p-3 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">{med.name}</p>
                                  <p className="text-[10px] text-zinc-400 font-bold mt-0.5">{med.dosage} • {med.frequency}{med.days ? ` • ${med.days}` : ""}</p>
                                  {med.remarks && <p className="text-[10px] text-zinc-500 italic mt-0.5">{med.remarks}</p>}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-400 italic text-center py-3">No medications were prescribed.</p>
                          )}
                        </div>
                      </section>

                      {/* Bottom action bar — view only */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <button onClick={() => setActivePatient(null)} className="px-5 py-2.5 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                          ← Back to List
                        </button>
                        <button
                          onClick={downloadPrescriptionPdf}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-extrabold transition-all shadow-md shadow-indigo-500/15 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          Download Report
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PATIENTS TAB */}
            {activeTab === "patients" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">Completed Patients</h2>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 font-medium">
                      {filteredCompletedPatients.length} patient{filteredCompletedPatients.length !== 1 ? "s" : ""} completed today
                    </p>
                  </div>
                  <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl shrink-0">
                    {(["all", "revisit"] as const).map((f) => (
                      <button key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                          statusFilter === f
                            ? "bg-white dark:bg-zinc-900 shadow-md text-sky-600 dark:text-sky-400"
                            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                      >
                        {f === "revisit" ? "Has Follow-up" : "All"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative max-w-md">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name or patient ID…"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-sky-400 placeholder-zinc-400 transition-colors shadow-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {filteredCompletedPatients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {searchQuery
                      ? <p className="text-sm font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
                      : <p className="text-sm font-medium">No completed consultations yet</p>}
                    <p className="text-xs mt-1">Patients move here after examination is completed</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Patient</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Doctor</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Department</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Visit Count</th>
                            <th className="px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Time</th>
                            <th className="px-5 py-3.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                          {filteredCompletedPatients.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center font-extrabold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                                    {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                      {p.age > 0 ? `${p.age} y/o` : "—"}
                                      {p.age > 0 && p.gender && p.gender !== "Unknown" ? " · " : ""}
                                      {p.gender && p.gender !== "Unknown" ? p.gender : "—"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {p.doctor || "—"}
                              </td>
                              <td className="px-5 py-4 text-xs text-zinc-500">
                                {p.department || "—"}
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-black px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800/40">
                                  {p.visitCode}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-zinc-400 whitespace-nowrap">{p.time}</td>
                              <td className="px-5 py-4">
                                <button
                                  onClick={() => fetchAndOpenPatient(p)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === "schedule" && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">
                      Upcoming Revisit Schedule
                    </h2>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 font-medium">
                      Patients with follow-up appointments from today onwards.
                    </p>
                  </div>
                  <span className="px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/40 dark:border-amber-800/40">
                    {upcomingSchedules.length} Revisit{upcomingSchedules.length !== 1 ? "s" : ""} Scheduled
                  </span>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xl font-black">
                      📅
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">Total Upcoming</span>
                      <h3 className="text-3xl font-black mt-0.5 text-zinc-800 dark:text-zinc-100">{upcomingSchedules.length}</h3>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xl font-black">
                      🗓
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">Due Today</span>
                      <h3 className="text-3xl font-black mt-0.5 text-zinc-800 dark:text-zinc-100">
                        {upcomingSchedules.filter(p => {
                          const d = new Date(p.followUp!); d.setHours(0,0,0,0);
                          const t = new Date(); t.setHours(0,0,0,0);
                          return d.getTime() === t.getTime();
                        }).length}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-black">
                      📋
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">This Week</span>
                      <h3 className="text-3xl font-black mt-0.5 text-zinc-800 dark:text-zinc-100">
                        {upcomingSchedules.filter(p => {
                          const d = new Date(p.followUp!);
                          const t = new Date();
                          const diff = (d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
                          return diff <= 7;
                        }).length}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Revisit Cards */}
                {upcomingSchedules.length > 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-black text-zinc-800 dark:text-zinc-200 mb-5 tracking-tight">
                      Patient Revisit List
                    </h3>
                    <div className="space-y-4">
                      {upcomingSchedules.map((patient) => {
                        const followDate = new Date(patient.followUp!);
                        const todayCheck = new Date(); todayCheck.setHours(0,0,0,0);
                        followDate.setHours(0,0,0,0);
                        const isToday = followDate.getTime() === todayCheck.getTime();
                        const isTomorrow = followDate.getTime() === todayCheck.getTime() + 86400000;
                        const diffDays = Math.round((followDate.getTime() - todayCheck.getTime()) / 86400000);

                        return (
                          <div
                            key={patient.id}
                            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                              isToday
                                ? "bg-amber-50/60 dark:bg-amber-950/10 border-amber-300/50 dark:border-amber-700/30"
                                : "bg-transparent border-zinc-200 dark:border-zinc-800 hover:border-sky-400/40"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-zinc-800 dark:to-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-center font-extrabold text-indigo-600 dark:text-indigo-400 text-sm shrink-0">
                                {patient.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-extrabold text-base text-zinc-800 dark:text-zinc-200">{patient.name}</h4>
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-bold text-zinc-500">{patient.patientId || patient.id}</span>
                                  {isToday && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">Today</span>
                                  )}
                                  {isTomorrow && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500 text-white">Tomorrow</span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-1">{patient.age} y/o • {patient.gender}</p>
                                {patient.primaryDiagnosis && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium line-clamp-1">
                                    <span className="text-zinc-400 dark:text-zinc-600 font-bold uppercase text-[10px] tracking-wider mr-1">Dx:</span>
                                    {patient.primaryDiagnosis}
                                  </p>
                                )}
                                {patient.notes && (
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-1 italic">{patient.notes}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Follow-up Date</p>
                                <p className="text-base font-black text-zinc-800 dark:text-zinc-200 mt-0.5">
                                  {new Date(patient.followUp!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                </p>
                                <p className={`text-xs font-bold mt-0.5 ${isToday ? "text-amber-600 dark:text-amber-400" : isTomorrow ? "text-sky-600 dark:text-sky-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                                  {isToday ? "Due today" : isTomorrow ? "Due tomorrow" : `In ${diffDays} day${diffDays !== 1 ? "s" : ""}`}
                                </p>
                              </div>
                              <button
                                onClick={() => { setActivePatient(patient); setIsExamining(true); setActiveTab("overview"); }}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-500/10"
                              >
                                Open EHR
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-16 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-3xl mb-4">
                      📅
                    </div>
                    <h4 className="font-extrabold text-lg text-zinc-700 dark:text-zinc-300">No Upcoming Revisits</h4>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 max-w-xs leading-relaxed">
                      When you assign a follow-up date to a patient in the Overview tab, their revisit will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* RECEPTIONIST DASHBOARD */
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left Column: Check-in Form */}
            <div className="xl:col-span-1">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                    Patient Registration Check-In
                  </h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Check in arrived patients and assign them to an on-duty medical team.
                  </p>
                </div>

                {(recSuccessMessage || recQueueError) && (
                  <div className={`mb-5 p-4 rounded-xl text-xs font-bold ${recQueueError ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/30 dark:border-rose-800/30" : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/30 dark:border-emerald-800/30 animate-pulse"}`}>
                    {recQueueError || recSuccessMessage}
                  </div>
                )}

                <form onSubmit={handleQueueCheckIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Full Name</label>
                    <input type="text" required value={recFullName} onChange={(e) => setRecFullName(e.target.value)}
                      placeholder="e.g. Johnathan Doe"
                      className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Age</label>
                      <input type="number" min={0} required value={recAge} onChange={(e) => setRecAge(e.target.value)}
                        placeholder="e.g. 34"
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Sex</label>
                      <select required value={recSex} onChange={(e) => setRecSex(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Phone Number</label>
                    <div className="flex gap-2">
                      <select value={recCountryCode}
                        onChange={(e) => { setRecCountryCode(e.target.value); setRecPhone(formatPhoneForCountry(e.target.value, recPhone)); }}
                        className="w-28 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-3 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none">
                        <option value="+1">+1 US</option>
                        <option value="+44">+44 UK</option>
                        <option value="+91">+91 IN</option>
                        <option value="+234">+234 NG</option>
                        <option value="+61">+61 AU</option>
                      </select>
                      <input type="tel" required value={recPhone} onChange={(e) => setRecPhone(formatPhoneForCountry(recCountryCode, e.target.value))}
                        placeholder="e.g. 555 012 3456"
                        className="flex-1 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                    </div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">Select country code and enter local number (no leading zeros).</p>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Address</label>
                    <input type="text" required value={recAddress} onChange={(e) => setRecAddress(e.target.value)}
                      placeholder="Street, city, state"
                      className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Assign Doctor</label>
                    <select required value={recDoctor} onChange={(e) => handleSelectDoctor(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none">
                      <option value="">Select Doctor On-duty</option>
                      {availableDoctors.length > 0 ? (
                        availableDoctors.map((doc) => (
                          <option key={doc.id} value={doc.name}>
                            {doc.name} {doc.department ? `(${doc.department})` : ""}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No doctors registered yet</option>
                      )}
                    </select>
                  </div>

                  {recDept && (
                    <div className="p-3.5 bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100/30 dark:border-sky-800/20 rounded-2xl">
                      <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                        Assigned Ward / Department
                      </span>
                      <span className="text-sm font-black text-sky-600 dark:text-sky-400 mt-1 block">{recDept}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Priority Level</label>
                      <select value={recPriority} onChange={(e) => setRecPriority(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Priority Badge</label>
                      <div className="h-[46px] flex items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/30">
                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                          recPriority === "Critical" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" :
                          recPriority === "High"     ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" :
                          recPriority === "Medium"   ? "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300" :
                          "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}>
                          {recPriority}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Reason for Visit</label>
                    <textarea rows={3} required value={recReason} onChange={(e) => setRecReason(e.target.value)}
                      placeholder="Observation, symptoms, chest tightness, fever, checkup..."
                      className="w-full p-4 text-sm bg-slate-50 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl focus:border-sky-500 focus:outline-none placeholder-zinc-400 transition-colors resize-none" />
                    {(vitalsRequirements.isCardiac || vitalsRequirements.isFever) && (
                      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {vitalsRequirements.isCardiac && (
                          <span>Cardiac-related complaint detected — BP and pulse should be recorded before queuing.</span>
                        )}
                        {vitalsRequirements.isCardiac && vitalsRequirements.isFever && <span> </span>}
                        {vitalsRequirements.isFever && (
                          <span>Fever-related complaint detected — temperature should be recorded before queuing.</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Blood Pressure</label>
                      <input type="text" value={recBP} onChange={(e) => setRecBP(e.target.value)} placeholder="e.g. 120/80"
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Pulse (bpm)</label>
                      <input type="number" value={recPulse} onChange={(e) => setRecPulse(e.target.value)} placeholder="e.g. 78"
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">Temperature (°F)</label>
                      <input type="number" step="0.1" value={recTemp} onChange={(e) => setRecTemp(e.target.value)} placeholder="e.g. 99.6"
                        className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 px-4 py-3 rounded-2xl text-sm focus:border-sky-500 focus:outline-none placeholder-zinc-400" />
                    </div>
                  </div>

                  <button type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-sky-500/10">
                    Check In Patient & Queue
                  </button>
                </form>
              </div>
            </div>

            {/* Right 2 Columns: Live Queue Monitor */}
            <div className="xl:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">Queue Length</span>
                    <h3 className="text-3xl font-black mt-1 text-zinc-800 dark:text-zinc-100">{queue.length}</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">Q</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">Avg Wait Time</span>
                    <h3 className="text-3xl font-black mt-1 text-zinc-800 dark:text-zinc-100">14 min</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">⏱</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">Active Wards</span>
                    <h3 className="text-3xl font-black mt-1 text-zinc-800 dark:text-zinc-100">4</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">🏥</div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                      Live Hospital Waiting Queue Monitor
                    </h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      Real-time queue tracking assigned patients to on-duty practitioners.
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-indigo-100/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-full">
                    Auto-updating
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Queue ID</th>
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Patient Info</th>
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Assigned Doctor</th>
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Check In</th>
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Priority</th>
                        <th className="py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {queue.length > 0 ? (
                        queue.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="py-4 text-sm font-black text-zinc-800 dark:text-zinc-200">{item.id}</td>
                            <td className="py-4 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                              <div>{item.name}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{item.age} y/o • {item.gender}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{item.phone}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1 max-w-[220px]">{item.address}</div>
                            </td>
                            <td className="py-4">
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 block">{item.doctor}</span>
                              <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider">{item.department}</span>
                            </td>
                            <td className="py-4 text-xs font-semibold text-zinc-400 dark:text-zinc-500">{item.checkInTime}</td>
                            <td className="py-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                item.priority === "Critical" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" :
                                item.priority === "High"     ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" :
                                item.priority === "Medium"   ? "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300" :
                                "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              }`}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button onClick={() => handleRemoveQueue(item.id)} className="text-rose-500 hover:text-rose-600 text-xs font-bold underline">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-zinc-400 text-xs font-medium italic">
                            No patients currently waiting in queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}