"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/data-db";

export function AdminUserRow({ user, currentUserId }: { user: AdminUser; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isSelf = user.id === currentUserId;

  async function deleteUser() {
    if (!confirm(`Delete ${user.email}? This removes all their data permanently.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else { alert("Failed to delete user"); setBusy(false); }
  }

  async function toggleAdmin() {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) router.refresh();
    else { alert("Failed"); setBusy(false); }
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl px-2 py-3 ${isSelf ? "bg-accent/5" : "hover:bg-white/3"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {user.name ?? <span className="text-muted italic">No name</span>}
          {user.isAdmin && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-accent">Admin</span>}
          {isSelf && <span className="ml-1 text-[10px] text-muted">(you)</span>}
        </div>
        <div className="text-xs text-muted truncate">{user.email}</div>
      </div>
      <div className="w-16 text-center text-sm font-mono text-muted">{user.sessionCount}</div>
      <div className="w-20 text-center text-xs text-muted">{user.createdAt}</div>
      <div className="w-20 flex gap-1 justify-end">
        {!isSelf && (
          <>
            <button
              onClick={toggleAdmin}
              disabled={busy}
              title={user.isAdmin ? "Remove admin" : "Make admin"}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition text-xs"
            >
              {user.isAdmin ? "★" : "☆"}
            </button>
            <button
              onClick={deleteUser}
              disabled={busy}
              title="Delete user"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted hover:text-bad hover:bg-bad/10 transition text-xs"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
