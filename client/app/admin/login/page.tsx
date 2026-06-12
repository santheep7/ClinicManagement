"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function AdminLogin() {
  const router = useRouter();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.set(".animate-box", { y: 30, opacity: 0 });
    gsap.set(".animate-input", { x: -20, opacity: 0 });
    gsap.set(".animate-btn", { scale: 0.9, opacity: 0 });

    const tl = gsap.timeline();
    tl.to(".animate-box", { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" })
      .to(".animate-input", { x: 0, opacity: 1, duration: 0.5, stagger: 0.15, ease: "back.out(1.7)" }, "-=0.2")
      .to(".animate-btn", { scale: 1, opacity: 1, duration: 0.4, ease: "elastic.out(1, 0.7)" }, "-=0.2");
  }, { scope: containerRef });

  const PREDEFINED_ADMIN_ID = "ADMIN-7890";
  const PREDEFINED_PASSWORD = "SuperAdminPassword2026";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminId === PREDEFINED_ADMIN_ID && password === PREDEFINED_PASSWORD) {
      localStorage.setItem("isAdminAuthenticated", "true");
      router.push("/admin/dashboard"); // Navigates to the true dashboard
    } else {
      setError("Invalid Admin ID or Password. Please try again.");
      gsap.fromTo(".animate-box", 
        { x: -10 }, 
        { x: 10, duration: 0.1, yoyo: true, repeat: 3, onComplete: () => gsap.set(".animate-box", { x: 0 }) }
      );
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    gsap.to(e.target, { scale: 1.02, duration: 0.3, ease: "power2.out", boxShadow: "0px 0px 8px rgba(37, 99, 235, 0.4)", borderColor: "#2563eb" });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    gsap.to(e.target, { scale: 1, duration: 0.3, ease: "power2.out", boxShadow: "none", borderColor: "#e2e8f0" });
  };

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-box w-full max-w-md bg-white p-8 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-6">Admin Portal</h1>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="animate-input">
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin ID</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border rounded-md text-slate-800"
              placeholder="E.g. ADMIN-7890"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <div className="animate-input">
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full px-4 py-2 border rounded-md text-slate-800"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <button type="submit" className="animate-btn w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
            Access Admin Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}