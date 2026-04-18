"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TimeRecord, Department } from "@/lib/types";
import ImportButton from "./ImportButton";
import AddShiftModal from "./AddShiftModal";
import DateRangePicker, { DateRange } from "@/components/DateRangePicker";
import ShiftTable, { ShiftRow } from "@/components/ShiftTable";
import SearchableSelect from "@/components/SearchableSelect";
import ChecklistSelect from "@/components/ChecklistSelect";
import { useImport } from "@/lib/import-context";

interface TeamMember { profile_id: string; name: string | null; }

interface Props {
  currentUserId: string;
  restaurantId: string;
  canViewAll: boolean;
  canApprove: boolean;
  canEdit: boolean;
  departments: Department[];
  teamMembers: TeamMember[];
  profilesMap: Record<string, string>;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftsClient({
  currentUserId, restaurantId, canViewAll, canApprove, canEdit,
  departments, teamMembers, profilesMap,
}: Props) {
  const supabase = createClient();
  const { isRunning: importRunning } = useImport();

  const [records,     setRecords]     = useState<ShiftRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [clocking,    setClocking]    = useState(false);
  const [activeShift, setActiveShift] = useState<TimeRecord | null>(null);
  const [showAddShift, setShowAddShift] = useState(false);

  const [deptFilter,   setDeptFilter]   = useState("");
  const [memberFilter, setMemberFilter] = useState<string[]>(canViewAll ? [] : [currentUserId]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${day}` };
  });
  const dateRangeRef = useRef(dateRange);

  // loadRecords reads dateRange from ref so calling it directly works without stale closure
  const loadRecords = useCallback(async () => {
    setLoading(true);
    const r = dateRangeRef.current;
    let query = supabase
      .from("time_records")
      .select("*, department:department_id(name)")
      .eq("restaurant_id", restaurantId)
      .gte("clocked_in_at", r.from + "T00:00:00")
      .lte("clocked_in_at", r.to   + "T23:59:59")
      .order("clocked_in_at", { ascending: false });

    if (!canViewAll) query = query.eq("profile_id", currentUserId);
    else if (memberFilter.length > 0) query = query.in("profile_id", memberFilter);
    if (deptFilter)   query = query.eq("department_id", deptFilter);
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data } = await query;
    setRecords((data as ShiftRow[]) || []);
    setLoading(false);
  }, [restaurantId, deptFilter, memberFilter, statusFilter, canViewAll, currentUserId]);
  // Note: dateRange intentionally NOT in deps — use ref to avoid stale closure

  const loadActiveShift = useCallback(async () => {
    const { data } = await supabase
      .from("time_records").select("*")
      .eq("profile_id", currentUserId).eq("restaurant_id", restaurantId)
      .eq("status", "active").limit(1).maybeSingle();
    setActiveShift(data as TimeRecord | null);
  }, [currentUserId, restaurantId]);

  useEffect(() => { loadRecords(); loadActiveShift(); }, [loadRecords, loadActiveShift]);

  async function handleClock() {
    setClocking(true);
    if (activeShift) {
      await supabase.from("time_records")
        .update({ clocked_out_at: new Date().toISOString(), status: "pending" })
        .eq("id", activeShift.id);
    } else {
      await supabase.from("time_records").insert({
        profile_id: currentUserId, restaurant_id: restaurantId,
        clocked_in_at: new Date().toISOString(), status: "active",
      });
    }
    await loadActiveShift();
    await loadRecords();
    setClocking(false);
  }

  async function handleApproveAll() {
    const ids = records.filter(r => r.status === "pending").map(r => r.id);
    if (!ids.length) return;
    await supabase.from("time_records")
      .update({ status: "approved", approved_by: currentUserId, approved_at: new Date().toISOString() })
      .in("id", ids);
    loadRecords();
  }

  const pendingCount = records.filter(r => r.status === "pending").length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Shifts</h1>
          {pendingCount > 0 && canApprove && (
            <p className="text-sm text-amber-600 mt-0.5">{pendingCount} shift{pendingCount > 1 ? "s" : ""} awaiting approval</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canApprove && pendingCount > 0 && (
            <button onClick={handleApproveAll}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
              Approve all ({pendingCount})
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowAddShift(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors">
              + Add shift
            </button>
          )}
          {canEdit && <ImportButton onImported={loadRecords} />}
          <button onClick={handleClock} disabled={clocking}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              activeShift ? "bg-red-500 hover:bg-red-600 text-white" : "bg-gray-900 hover:bg-gray-700 text-white"
            }`}>
            {clocking ? "…" : activeShift ? "⏹ Clock out" : "▶ Clock in"}
          </button>
        </div>
      </div>

      {activeShift && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-5">
          🟢 Active shift started at {formatTime(activeShift.clocked_in_at)}
        </div>
      )}

      {/* Filters — relative z-10 keeps calendar dropdown above ShiftTable card */}
      <div className="relative bg-white rounded-2xl border border-gray-100 px-5 py-4 mb-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
          <DateRangePicker initialRange={dateRange} onChange={r => { dateRangeRef.current = r; setDateRange(r); loadRecords(); }} />
          <div className="flex flex-wrap gap-2 items-center">
            {canViewAll && (
              <SearchableSelect
                value={deptFilter}
                onChange={setDeptFilter}
                placeholder="All departments"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
            )}
            {canViewAll && (
              <ChecklistSelect
                values={memberFilter}
                onChange={setMemberFilter}
                placeholder="All employees"
                options={teamMembers.map(m => ({ value: m.profile_id, label: m.name || m.profile_id }))}
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                  </svg>
                }
              />
            )}
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All statuses"
              options={[
                { value: "active",   label: "Active" },
                { value: "pending",  label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </div>
        </div>
      </div>

      {importRunning && (
        <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin flex-shrink-0" />
          Import in progress — shift editing is temporarily disabled.
        </div>
      )}

      <ShiftTable
        shifts={records}
        loading={loading}
        currentUserId={currentUserId}
        canEdit={canEdit && !importRunning}
        canApprove={canApprove}
        profilesMap={canViewAll ? profilesMap : undefined}
        onRefresh={loadRecords}
      />

      {showAddShift && (
        <AddShiftModal
          restaurantId={restaurantId}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onSaved={loadRecords}
          onClose={() => setShowAddShift(false)}
        />
      )}
    </div>
  );
}
