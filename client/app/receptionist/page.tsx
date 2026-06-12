"use client";

import { useEffect, useState } from "react";

interface QueueItem {
  id: string; // Map to database patient record ID string (e.g., MongoDB _id or Postgres UUID)
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  doctor: string;
  department: string;
  reason: string;
  priority: string;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function ReceptionistDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [doctor, setDoctor] = useState("");
  const [department, setDepartment] = useState("");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("Low");
  const [message, setMessage] = useState("");

  // 1. Core Authentication Guard & Initial Component Mount State
  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      window.location.href = "/";
      return;
    }
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
  }, []);

  // 2. Pure Database Fetch: Load Live Patient Queue
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const loadQueue = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patients`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Server returned error status: ${response.status}`);
        }

        const data = await response.json();
        setQueue(data.patients || []);
      } catch (error) {
        console.error("Database connection lost or unreadable:", error);
        alert("Critical Error: Unable to fetch live queue data from backend server database.");
      }
    };

    loadQueue();
  }, [mounted]);

  // 3. Pure Database Fetch: Populate Dynamic Duty Doctors List
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const loadDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/doctors`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Server returned error status: ${response.status}`);
        }

        const data = await response.json();
        setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
      } catch (error) {
        console.error("Unable to query active doctor entities:", error);
      }
    };

    loadDoctors();
  }, [mounted]);

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

  // 4. Create Operations: Save patient straight into the server database
  async function handleAddToQueue(event: React.FormEvent) {
    event.preventDefault();
    if (!name || !age || !phone || !address || !reason || !doctorId) {
      setMessage("Please complete all fields before queuing the patient.");
      return;
    }

    const payload = {
      name: name.trim(),
      age: Number(age),
      gender,
      phone: phone.trim(),
      address: address.trim(),
      doctor,
      department,
      reason: reason.trim(),
      priority,
      bloodPressure: bp.trim() || undefined,
      heartRate: pulse.trim() ? Number(pulse) : undefined,
      temperature: temperature.trim() || undefined,
      checkInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      doctorId
    };

    const token = localStorage.getItem("accessToken");
    if (!token) {
      alert("Authentication token missing. Please sign back in.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/patients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        // Insert the actual database generated record directly into state row collection mapping
        setQueue((current) => [data.patient, ...current]);
        setMessage("Patient checked in and committed to database successfully.");
        
        // Clear input state contexts completely upon successful record commit
        setName("");
        setAge("");
        setGender("Male");
        setPhone("");
        setAddress("");
        setReason("");
        setPriority("Low");
        setBp("");
        setPulse("");
        setTemperature("");
        setDoctorId("");
        setDoctor("");
        setDepartment("");
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to save record to server database: ${errData.message || response.statusText}`);
      }
    } catch (error) {
      console.error("Network communication exception context:", error);
      alert("Network Error: Could not save patient dataset. Ensure your backend server is active.");
    }

    setTimeout(() => setMessage(""), 3000);
  }

  // 5. Delete Operations: Hard purge the specific record row inside database container
  async function removeQueueItem(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Only safely update UI layout after backend database issues verification
        setQueue((current) => current.filter((item) => item.id !== id));
        setMessage("Patient row dropped from backend collection.");
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(`Server refused deletion operation request. Database returned status code: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to execute data deletion flow inside API routing block:", error);
      alert("Network Connection Blocked: Could not establish sync to clear database record row entry.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-zinc-900">
      {!mounted || !user ? (
        <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
          <div className="text-center p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-zinc-600 font-medium">Connecting to system database architecture...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-8 py-6 shadow-sm">
            <div>
              <h1 className="text-3xl font-extrabold">Receptionist Dashboard</h1>
              <p className="text-sm text-zinc-600 mt-1">Live Database Pipeline Mode</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-zinc-500">Signed in as</p>
                <p className="font-bold text-zinc-900">{user.fullName}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="p-8 grid gap-8 xl:grid-cols-[1fr_1.6fr]">
            <section className="rounded-3xl bg-white border border-zinc-200 p-6 shadow-sm">
              <h2 className="text-xl font-extrabold text-zinc-900 mb-4">Patient Check-In</h2>
              {message && <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{message}</div>}
              <form onSubmit={handleAddToQueue} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Full Name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    placeholder="e.g. Rachel Nwachukwu"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Age</label>
                    <input
                      type="number"
                      min={0}
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                      placeholder="34"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Sex</label>
                    <select
                      value={gender}
                      onChange={(event) => setGender(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Phone</label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(formatPhone("+1", event.target.value))}
                    className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    placeholder="555-012-3456"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Address</label>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    placeholder="Street, city, state"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Blood Pressure</label>
                    <input
                      value={bp}
                      onChange={(event) => setBp(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                      placeholder="e.g. 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(event) => setPulse(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                      placeholder="72"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Temperature (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(event) => setTemperature(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                      placeholder="98.6"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Reason for Visit</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="w-full rounded-3xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    placeholder="Symptoms, checkup, referral reason..."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Assign Doctor</label>
                    <select
                      value={doctorId}
                      onChange={(event) => handleDoctorChange(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    >
                      <option value="">Select doctor from live database</option>
                      {doctors.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.department})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Priority</label>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:outline-none"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Critical</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700 transition-colors"
                >
                  Check In Patient
                </button>
              </form>
            </section>

            <section className="rounded-3xl bg-white border border-zinc-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-zinc-900">Live Database Queue</h2>
                  <p className="text-sm text-zinc-600 mt-1">Active database items waiting for consultation processing.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-700">{queue.length} connected</span>
              </div>
              <div className="space-y-4">
                {queue.length > 0 ? (
                  queue.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-zinc-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-zinc-500">ID: {item.id}</p>
                          <h3 className="text-lg font-bold text-zinc-900">{item.name}</h3>
                          <p className="text-sm text-zinc-600">{item.age} y/o • {item.gender}</p>
                          <p className="text-sm text-zinc-600 mt-1">Assigned to {item.doctor || "Unassigned"}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">{item.priority}</span>
                          <p className="text-xs text-zinc-500 mt-2">{item.checkInTime}</p>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-zinc-700">
                        <p className="font-semibold">Reason:</p>
                        <p>{item.reason}</p>
                        <p className="mt-3 text-xs text-zinc-500">{item.address}</p>
                      </div>
                      <div className="mt-4 text-right">
                        <button
                          onClick={() => removeQueueItem(item.id)}
                          className="rounded-2xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-zinc-200 p-10 text-center text-zinc-600">
                    No active patient records fetched from database.
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}