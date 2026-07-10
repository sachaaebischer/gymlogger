"use client";
import { useState } from "react";

export default function ProfileForm({ name, email }: { name: string; email: string }) {
  const [displayName, setDisplayName] = useState(name);
  const [nameMsg, setNameMsg] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg("");
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: displayName }),
    });
    const data = await res.json();
    setNameMsg(data.ok ? "Name updated." : (data.error ?? "Error"));
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    if (newPw !== confirmPw) { setPwMsg("Passwords don't match."); return; }
    if (newPw.length < 6) { setPwMsg("Password must be at least 6 characters."); return; }
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (data.ok) {
      setPwMsg("Password updated.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg(data.error ?? "Error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="text-sm font-semibold text-muted uppercase tracking-wide">Account</div>
        <div>
          <div className="text-xs text-muted mb-1">Email</div>
          <div className="text-sm">{email}</div>
        </div>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Display name</label>
            <input
              className="w-full bg-surface border border-cardborder rounded-lg px-3 py-2 text-sm text-fg"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <button type="submit" className="btn-primary text-sm px-4 py-2">Save name</button>
          {nameMsg && <p className={`text-xs ${nameMsg.includes("updated") ? "text-good" : "text-bad"}`}>{nameMsg}</p>}
        </form>
      </div>

      <div className="card space-y-4">
        <div className="text-sm font-semibold text-muted uppercase tracking-wide">Change Password</div>
        <form onSubmit={savePassword} className="space-y-3">
          {[
            { label: "Current password", val: currentPw, set: setCurrentPw },
            { label: "New password", val: newPw, set: setNewPw },
            { label: "Confirm new password", val: confirmPw, set: setConfirmPw },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="text-xs text-muted mb-1 block">{label}</label>
              <input
                type="password"
                className="w-full bg-surface border border-cardborder rounded-lg px-3 py-2 text-sm text-fg"
                value={val}
                onChange={e => set(e.target.value)}
                required
              />
            </div>
          ))}
          <button type="submit" className="btn-primary text-sm px-4 py-2">Update password</button>
          {pwMsg && <p className={`text-xs ${pwMsg.includes("updated") ? "text-good" : "text-bad"}`}>{pwMsg}</p>}
        </form>
      </div>
    </div>
  );
}
