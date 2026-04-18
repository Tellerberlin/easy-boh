"use client";
import { useState } from "react";
import Link from "next/link";
import TimeInput from "@/components/TimeInput";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────
export interface ShiftRow {
  id: string;
  profile_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  status: string;
  notes: string | null;
  department?: { name: string } | null;
}

interface Props {
  shifts: ShiftRow[];
  loading?: boolean;
  currentUserId: string;
  canEdit: boolean;
  canApprove?: boolean;
  /** Pass to show employee name column and link each row to their profile page */
  profilesMap?: Record<string, string>;
  onRefresh: () => void;
}

// ── Helpers ───────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

function toTimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function calcHours(inAt: string, outAt: string | null) {
  if (!outAt) return "—";
  const h = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3600000;
  return `${h.toFixed(2)} hrs`;
}

function buildISO(originalISO: string, newTime: string, clockInISO?: string): string {
  const [hh, mm] = newTime.split(":").map(Number);
  const refDate = clockInISO ? new Date(clockInISO) : new Date(originalISO);
  const result = new Date(refDate);
  result.setHours(hh, mm, 0, 0);
  if (clockInISO) {
    const inTime = new Date(clockInISO);
    if (hh * 60 + mm < inTime.getHours() * 60 + inTime.getMinutes()) {
      result.setDate(result.getDate() + 1);
    }
  }
  return result.toISOString();
}

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-blue-50 text-blue-700",
  pending:  "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

type SortKey = "date" | "employee" | "status";
type SortDir = "asc" | "desc";
type EditKey = `${string}:${"in" | "out"}`;


function SortTh({ label, sortKey, current, dir, onSort, className = "" }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th className={`text-left px-3 py-3 cursor-pointer select-none group ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
        <span className={active ? "text-gray-700" : ""}>{label}</span>
        <span className={`text-[10px] transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
          {active && dir === "asc" ? "↑" : "↓"}
        </span>
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────
export default function ShiftTable({
  shifts, loading, currentUserId, canEdit, canApprove, profilesMap, onRefresh,
}: Props) {
  const supabase = createClient();
  const showEmployee = !!profilesMap;

  // Editing
  const [editingCell, setEditingCell] = useState<EditKey | null>(null);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [saveError,   setSaveError]   = useState<string | null>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function startEdit(shiftId: string, field: "in" | "out") {
    if (!canEdit) return;
    const s = shifts.find(x => x.id === shiftId)!;
    if (s.status === "active") return;
    setEditingCell(`${shiftId}:${field}`);
    setEditError(null);
    setSaveError(null);
  }

  async function commitEdit(shiftId: string, field: "in" | "out", finalValue: string) {
    const s = shifts.find(x => x.id === shiftId);
    if (!s || !finalValue) { setEditingCell(null); return; }

    const isoValue = field === "in"
      ? buildISO(s.clocked_in_at, finalValue)
      : buildISO(s.clocked_out_at || s.clocked_in_at, finalValue, s.clocked_in_at);

    // Validation
    if (field === "out" && s.clocked_in_at && new Date(isoValue) <= new Date(s.clocked_in_at)) {
      setEditError(`${shiftId}:out`); setEditingCell(null);
      setTimeout(() => setEditError(null), 3000); return;
    }
    if (field === "in" && s.clocked_out_at && new Date(isoValue) >= new Date(s.clocked_out_at)) {
      setEditError(`${shiftId}:in`); setEditingCell(null);
      setTimeout(() => setEditError(null), 3000); return;
    }

    setSaving(`${shiftId}:${field}`);
    const payload = field === "in" ? { clocked_in_at: isoValue } : { clocked_out_at: isoValue };

    const res = await fetch(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(null);
    setEditingCell(null);

    if (!res.ok) {
      setSaveError(`${shiftId}:${field}`);
      setTimeout(() => setSaveError(null), 4000); return;
    }
    onRefresh();
  }

  async function handleApprove(id: string) {
    await supabase.from("time_records").update({
      status: "approved", approved_by: currentUserId, approved_at: new Date().toISOString(),
    }).eq("id", id);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this shift record?")) return;
    await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    onRefresh();
  }

  // ── Sort ───────────────────────────────────────────────────
  const sorted = [...shifts].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date")     cmp = new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime();
    if (sortKey === "employee") cmp = (profilesMap?.[a.profile_id] ?? "").localeCompare(profilesMap?.[b.profile_id] ?? "");
    if (sortKey === "status")   cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Net hours: deduct 30 min for any shift over 6 hrs
  const netHours = sorted.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum;
    const h = (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3600000;
    return sum + h - (h > 6 ? 0.5 : 0);
  }, 0);

  const colSpan = [true, showEmployee, true, true, true, true, canEdit].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      {/* Stats header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-4">
        {loading ? (
          <span className="text-xs text-gray-400">Loading…</span>
        ) : (
          <>
            <span className="text-sm text-gray-600">
              <span className="font-semibold">{sorted.length}</span>{" "}
              shift{sorted.length !== 1 ? "s" : ""}
            </span>
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <span className="font-semibold">{netHours.toFixed(1)}</span> hrs
              {/* Tooltip */}
              <span className="relative group inline-flex items-center cursor-help">
                <span className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] font-bold inline-flex items-center justify-center leading-none select-none">?</span>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-[60]">
                  <div className="bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    30-min break deducted for shifts over 6 hours
                  </div>
                  <div className="border-[5px] border-transparent border-t-gray-900 -mt-px" />
                </div>
              </span>
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <SortTh label="Date"   sortKey="date"   current={sortKey} dir={sortDir} onSort={toggleSort} className="px-5" />
            {showEmployee && <SortTh label="Employee" sortKey="employee" current={sortKey} dir={sortDir} onSort={toggleSort} />}
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400">Clock in</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400">Clock out</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400">Hours</th>
            {showEmployee && <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400">Department</th>}
            <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
            {canEdit && <th className="px-5 py-3" />}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-gray-400">
              No shifts for this period.
            </td></tr>
          ) : sorted.map((s, i) => {
            const editIn   = editingCell === `${s.id}:in`;
            const editOut  = editingCell === `${s.id}:out`;
            const isSaving = saving?.startsWith(s.id);
            const nextDay  = s.clocked_out_at &&
              new Date(s.clocked_out_at).toDateString() !== new Date(s.clocked_in_at).toDateString();
            const editable = canEdit && s.status !== "active";

            return (
              <tr key={s.id} className={`group hover:bg-gray-50 transition-colors ${i < sorted.length - 1 ? "border-b border-gray-100" : ""}`}>

                <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(s.clocked_in_at)}</td>

                {showEmployee && (
                  <td className="px-3 py-3 font-semibold whitespace-nowrap">
                    {profilesMap?.[s.profile_id]
                      ? <Link href={`/team/${s.profile_id}`} className="hover:text-indigo-600 transition-colors">{profilesMap[s.profile_id]}</Link>
                      : "—"}
                  </td>
                )}

                {/* Clock in */}
                <td className="px-3 py-3">
                  {editIn ? (
                    <TimeInput value={toTimeInput(s.clocked_in_at)}
                      onCommit={v => commitEdit(s.id, "in", v)} onCancel={() => setEditingCell(null)} />
                  ) : (
                    <span className="inline-flex flex-col gap-0.5">
                      <span onClick={() => editable && startEdit(s.id, "in")}
                        className={`font-mono text-xs ${editable ? "cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2" : ""} ${editError === `${s.id}:in` ? "text-red-500" : ""}`}>
                        {formatTime(s.clocked_in_at)}
                      </span>
                      {editError === `${s.id}:in` && <span className="text-[10px] text-red-500">Must be before end</span>}
                      {saveError === `${s.id}:in` && <span className="text-[10px] text-red-500">Save failed</span>}
                    </span>
                  )}
                </td>

                {/* Clock out */}
                <td className="px-3 py-3">
                  {editOut ? (
                    <TimeInput value={toTimeInput(s.clocked_out_at)}
                      onCommit={v => commitEdit(s.id, "out", v)} onCancel={() => setEditingCell(null)} />
                  ) : (
                    <span className="inline-flex flex-col gap-0.5">
                      <span onClick={() => editable && startEdit(s.id, "out")}
                        className={`font-mono text-xs inline-flex items-center gap-1 ${editable ? "cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2" : ""} ${editError === `${s.id}:out` ? "text-red-500" : ""}`}>
                        {s.clocked_out_at ? formatTime(s.clocked_out_at) : <span className="text-gray-300">—</span>}
                        {nextDay && <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-1 rounded">+1</span>}
                      </span>
                      {editError === `${s.id}:out` && <span className="text-[10px] text-red-500">Must be after start</span>}
                      {saveError === `${s.id}:out` && <span className="text-[10px] text-red-500">Save failed</span>}
                    </span>
                  )}
                </td>

                <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">
                  {isSaving ? <span className="text-gray-400">Saving…</span> : calcHours(s.clocked_in_at, s.clocked_out_at)}
                </td>

                {showEmployee && (
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {(s.department as { name: string } | null)?.name || "—"}
                  </td>
                )}

                <td className="px-3 py-3">
                  {s.status === "pending" && canApprove ? (
                    <button onClick={() => handleApprove(s.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                      Approve
                    </button>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status] || ""}`}>
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  )}
                </td>

                {canEdit && (
                  <td className="px-5 py-3">
                    <button onClick={() => handleDelete(s.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

    </div>
  );
}
