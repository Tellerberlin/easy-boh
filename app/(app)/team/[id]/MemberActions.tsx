"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";

interface Role { id: string; name: string; }

interface Props {
  profileId: string;
  currentRoleId: string;
  roles: Role[];
  contractEnd: string | null;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MemberActions({ profileId, currentRoleId, roles, contractEnd }: Props) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(currentRoleId);
  const [savingRole, setSavingRole] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);
  const [reinviting, setReinviting] = useState(false);
  const [reinvited, setReinvited] = useState(false);
  const [error, setError] = useState("");

  const [deactivating, setDeactivating] = useState(false);
  const [endDate, setEndDate] = useState(todayISO());
  const [savingDeactivate, setSavingDeactivate] = useState(false);
  const [localContractEnd, setLocalContractEnd] = useState(contractEnd);
  useEffect(() => { setLocalContractEnd(contractEnd); }, [contractEnd]);

  const isDeactivated = !!localContractEnd && localContractEnd <= todayISO();

  async function handleDeactivate() {
    setSavingDeactivate(true);
    setError("");
    const res = await fetch(`/api/members/${profileId}/contract`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_end: endDate }),
    });
    if (res.ok) {
      setLocalContractEnd(endDate);
      setDeactivating(false);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to deactivate");
    }
    setSavingDeactivate(false);
  }

  async function handleReactivate() {
    setSavingDeactivate(true);
    setError("");
    const res = await fetch(`/api/members/${profileId}/contract`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_end: null }),
    });
    if (res.ok) {
      setLocalContractEnd(null);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to reactivate");
    }
    setSavingDeactivate(false);
  }

  async function saveRole() {
    if (roleId === currentRoleId) return;
    setSavingRole(true);
    setError("");
    const res = await fetch(`/api/members/${profileId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    if (res.ok) {
      setRoleSaved(true);
      setTimeout(() => { setRoleSaved(false); router.refresh(); }, 1500);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update role");
    }
    setSavingRole(false);
  }

  async function handleReinvite() {
    setReinviting(true);
    setError("");
    const res = await fetch("/api/reinvite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    if (res.ok) {
      setReinvited(true);
      setTimeout(() => setReinvited(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to re-send invitation");
    }
    setReinviting(false);
  }

  return (
    <div className="flex flex-col items-end gap-3">
      {isDeactivated && (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
          Deactivated
        </span>
      )}
      {/* Role selector */}
      <div className="flex items-center gap-2">
        <select
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-gray-800"
        >
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {roleId !== currentRoleId && (
          <button
            onClick={saveRole}
            disabled={savingRole}
            className="px-3 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {savingRole ? "Saving…" : roleSaved ? "Saved ✓" : "Save role"}
          </button>
        )}
      </div>

      {/* Re-invite button */}
      <button
        onClick={handleReinvite}
        disabled={reinviting}
        className="text-sm text-gray-500 hover:text-gray-900 font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-800 transition-colors disabled:opacity-50"
      >
        {reinviting ? "Sending…" : reinvited ? "Invitation sent ✓" : "Re-send invitation"}
      </button>

      {/* Deactivate / Reactivate */}
      {isDeactivated ? (
        <button
          onClick={handleReactivate}
          disabled={savingDeactivate}
          className="text-sm text-green-600 hover:text-green-800 font-semibold px-3 py-2 rounded-xl border border-green-200 hover:border-green-400 transition-colors disabled:opacity-50"
        >
          {savingDeactivate ? "…" : "Reactivate"}
        </button>
      ) : deactivating ? (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DatePicker value={endDate} onChange={setEndDate} />
          <button
            onClick={handleDeactivate}
            disabled={savingDeactivate || !endDate}
            className="text-sm text-white bg-red-500 hover:bg-red-600 font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            {savingDeactivate ? "…" : "Confirm"}
          </button>
          <button onClick={() => setDeactivating(false)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>
      ) : (
        <button
          onClick={() => { setEndDate(localContractEnd ?? todayISO()); setDeactivating(true); }}
          className="text-sm text-red-500 hover:text-red-700 font-semibold px-3 py-2 rounded-xl border border-red-200 hover:border-red-400 transition-colors"
        >
          Deactivate
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
