"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AppContext } from "@/lib/types";
import { useImport } from "@/lib/import-context";

const navItems = [
  { href: "/shifts", label: "Shifts", icon: "⏱" },
  { href: "/team", label: "Team", icon: "◎", permission: "can_view_all_shifts" },
  { href: "/invitations", label: "Invitations", icon: "✉", permission: "can_invite" },
  { href: "/departments", label: "Departments", icon: "▦", permission: "can_manage_departments" },
  { href: "/roles", label: "Roles", icon: "⚿", permission: "can_manage_roles" },
];

export default function Sidebar({ ctx }: { ctx: AppContext }) {
  const pathname = usePathname();
  const router = useRouter();
  const { job, fileCount, isRunning, showResult, startError, dismiss } = useImport();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(ctx.profileName || "");
  const [savingName, setSavingName] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setSavingName(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    setSavingName(false);
    setEditingName(false);
    router.refresh();
  }

  const perms = ctx.role.permissions as Record<string, boolean>;
  const isOwner = ctx.role.is_owner;

  const visibleNav = navItems.filter(item => {
    if (!item.permission) return true;
    if (isOwner) return true;
    return perms[item.permission];
  });

  return (
    <aside className="w-52 flex flex-col fixed inset-y-0 left-0 z-20" style={{ background: "#1a1a1a" }}>
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <span className="text-white font-bold text-lg tracking-tight">EasyBOH</span>
        <span className="text-gray-400 text-xs block mt-0.5 truncate">{ctx.restaurantName}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleNav.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-white/15 text-white font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-white/8"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Import status — persists across navigation */}
      {(isRunning || showResult || startError) && (
        <div className="mx-3 mb-3 rounded-xl overflow-hidden text-xs">
          {isRunning && job && (
            <div className="bg-white/8 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block w-2.5 h-2.5 border-2 border-gray-500 border-t-white rounded-full animate-spin flex-shrink-0" />
                <span className="text-gray-300 font-medium">
                  Importing {fileCount} file{fileCount !== 1 ? "s" : ""}…
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1">
                <div className="bg-white h-1 rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
              </div>
              <p className="text-gray-500 mt-1">{job.processed}/{job.total} rows</p>
            </div>
          )}
          {showResult && job && (
            <div className="bg-white/8 px-3 py-2.5">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-green-400 font-semibold">✓ {job.shiftsImported} shifts imported</p>
                  {(job.createdEmployees ?? []).length > 0 && (
                    <p className="text-gray-400 mt-0.5">{job.createdEmployees.length} new employee{job.createdEmployees.length !== 1 ? "s" : ""} created</p>
                  )}
                  {(job.errors ?? []).length > 0 && (
                    <p className="text-red-400 mt-0.5">{job.errors.length} error{job.errors.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
                <button onClick={dismiss} className="text-gray-500 hover:text-white text-base leading-none flex-shrink-0 mt-0.5">×</button>
              </div>
            </div>
          )}
          {startError && (
            <div className="bg-red-900/40 px-3 py-2.5">
              <div className="flex items-start justify-between gap-1">
                <p className="text-red-400">{startError}</p>
                <button onClick={dismiss} className="text-red-400 hover:text-white text-base leading-none flex-shrink-0">×</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {editingName ? (
          <div className="px-3 mb-1 space-y-1.5">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 border border-white/20 focus:outline-none focus:border-white/50"
            />
            <div className="flex gap-1">
              <button onClick={saveName} disabled={savingName}
                className="flex-1 text-xs bg-white/15 hover:bg-white/25 text-white rounded-lg py-1 disabled:opacity-50 transition-colors">
                {savingName ? "…" : "Save"}
              </button>
              <button onClick={() => setEditingName(false)}
                className="flex-1 text-xs text-gray-400 hover:text-white rounded-lg py-1 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setNameInput(ctx.profileName || ""); setEditingName(true); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/8 w-full transition-colors group text-left"
          >
            <span className="text-base w-5 text-center">👤</span>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">
                {ctx.profileName || <span className="text-gray-500 italic font-normal">Add name</span>}
              </div>
              <div className="text-gray-500 text-xs truncate">{ctx.role.name}</div>
            </div>
          </button>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/8 w-full transition-colors"
        >
          <span className="text-base w-5 text-center">↩</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
