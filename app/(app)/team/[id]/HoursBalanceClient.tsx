"use client";
import { useState, useEffect } from "react";
import { countBerlinHolidaysInRange } from "@/lib/berlin-holidays";
import DatePicker from "@/components/DatePicker";

interface Props {
  profileId: string;
  canEdit: boolean;
  contractStart: string | null;
  contractEnd: string | null;
  hoursPerWeek: number | null;
  daysPerWeek: number | null;
  vacationDaysPerYear: number | null;
  initialSickDays: number;
  allShifts: { clocked_in_at: string; clocked_out_at: string | null; status: string }[];
}

function todayISO() {
  const d = new Date();
  // Use local date (not UTC) to match what the user expects
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calcWorkedHours(
  shifts: { clocked_in_at: string; clocked_out_at: string | null }[]
): number {
  return shifts.reduce((sum, s) => {
    if (!s.clocked_out_at) return sum;
    const raw = (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3600000;
    return sum + (raw > 6 ? raw - 0.5 : raw); // German break law
  }, 0);
}

export default function HoursBalanceClient({
  profileId,
  canEdit,
  contractStart,
  contractEnd,
  hoursPerWeek,
  daysPerWeek,
  vacationDaysPerYear,
  initialSickDays,
  allShifts,
}: Props) {
  const today = todayISO();
  const defaultUntil = contractEnd ?? today;
  const [untilDate, setUntilDate] = useState(defaultUntil);
  useEffect(() => {
    setUntilDate(contractEnd ?? today);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractEnd]);
  const maxDate = today;
  const [sickDays, setSickDays]   = useState(initialSickDays);
  const [editingSick, setEditingSick] = useState(false);
  const [sickDraft, setSickDraft]     = useState(String(initialSickDays));
  const [saving, setSaving] = useState(false);

  if (!contractStart || !hoursPerWeek) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Hours balance</h2>
        <p className="text-xs text-gray-400">Set a contract start date and weekly hours to see the balance.</p>
      </div>
    );
  }

  const dailyHours  = daysPerWeek ? hoursPerWeek / daysPerWeek : hoursPerWeek / 5;
  const periodStart = new Date(contractStart + "T00:00:00");
  const periodEnd   = new Date(untilDate + "T23:59:59");
  const periodDays  = Math.max(0, (periodEnd.getTime() - periodStart.getTime()) / 86400000);

  const vacationAccrued = vacationDaysPerYear != null
    ? (periodDays / 365) * vacationDaysPerYear
    : null;

  const shiftsInPeriod = allShifts.filter(s => {
    const t = new Date(s.clocked_in_at);
    return t >= periodStart && t <= periodEnd;
  });

  const workedHours   = calcWorkedHours(shiftsInPeriod);
  const expectedHours = (periodDays / 7) * hoursPerWeek;
  const holidayCount  = countBerlinHolidaysInRange(periodStart, periodEnd);
  const vacationCredit = vacationAccrued != null ? vacationAccrued * dailyHours : 0;
  const sickCredit     = sickDays * dailyHours;
  const holidayCredit  = holidayCount * dailyHours;
  const balance        = workedHours + vacationCredit + sickCredit + holidayCredit - expectedHours;

  async function saveSickDays() {
    const value = parseFloat(sickDraft);
    if (isNaN(value) || value < 0) return;
    setSaving(true);
    const res = await fetch(`/api/members/${profileId}/absences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sick_days: value }),
    });
    if (res.ok) { setSickDays(value); setEditingSick(false); }
    setSaving(false);
  }

  const balanceColor = balance >= 0 ? "text-green-600" : "text-red-500";
  const balanceSign  = balance >= 0 ? "+" : "";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Hours balance</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Until</label>
          {contractEnd && contractEnd <= today ? (
            <span className="text-xs font-medium text-gray-700 tabular-nums">
              {untilDate.split("-").reverse().join("/")}
            </span>
          ) : (
            <DatePicker value={untilDate} onChange={setUntilDate} maxDate={maxDate} />
          )}
        </div>
      </div>

      <div className="mb-5 flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${balanceColor}`}>
          {balanceSign}{balance.toFixed(1)}h
        </span>
        <span className="text-xs text-gray-400">balance</span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">

        <div>
          <p className="text-xs text-gray-400">Expected</p>
          <p className="font-medium tabular-nums">{expectedHours.toFixed(1)} hrs</p>
        </div>

        <div>
          <p className="text-xs text-gray-400">Worked <span className="text-[10px]">(break deducted)</span></p>
          <p className="font-medium tabular-nums">{workedHours.toFixed(1)} hrs</p>
        </div>

        <div>
          <p className="text-xs text-gray-400">Vacation accrued</p>
          {vacationAccrued != null ? (
            <p className="font-medium tabular-nums">
              {vacationAccrued.toFixed(1)} days
              <span className="text-xs text-gray-400 font-normal ml-1">(= {vacationCredit.toFixed(1)} hrs)</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400">— set vacation days/year in contract</p>
          )}
        </div>

        {/* Sick days — editable */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Sick days</p>
          {editingSick && canEdit ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="number" min={0} step={0.5} value={sickDraft}
                onChange={e => setSickDraft(e.target.value)}
                autoFocus
                className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 tabular-nums"
                onKeyDown={e => { if (e.key === "Enter") saveSickDays(); if (e.key === "Escape") setEditingSick(false); }}
              />
              <button onClick={saveSickDays} disabled={saving}
                className="text-xs text-indigo-600 font-semibold disabled:opacity-50">
                {saving ? "…" : "Save"}
              </button>
              <button onClick={() => setEditingSick(false)} className="text-xs text-gray-400">✕</button>
            </span>
          ) : (
            <p onClick={() => canEdit && (setSickDraft(String(sickDays)), setEditingSick(true))}
              className={`font-medium tabular-nums inline-flex items-center gap-1.5 ${canEdit ? "cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2" : ""}`}>
              {sickDays} days
              <span className="text-xs text-gray-400 font-normal">(= {sickCredit.toFixed(1)} hrs)</span>
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-400">Public holidays</p>
          <p className="font-medium tabular-nums">
            {holidayCount} days
            <span className="text-xs text-gray-400 font-normal ml-1">(= {holidayCredit.toFixed(1)} hrs)</span>
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400">Daily hours</p>
          <p className="font-medium tabular-nums">{dailyHours.toFixed(1)} hrs/day</p>
        </div>

      </div>

      {daysPerWeek == null && (
        <p className="mt-3 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Days per week not set — defaulting to 5. Set it in contract details for accurate daily hours.
        </p>
      )}
    </div>
  );
}
