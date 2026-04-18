"use client";
import { useState } from "react";
import Link from "next/link";

interface Dept { id: string; name: string; }
interface Role { id: string; name: string; }

export default function NewInvitationClient({
  departments: initialDepts, roles: initialRoles, autoApprove,
}: { departments: Dept[]; roles: Role[]; autoApprove: boolean; }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState(initialRoles[0]?.id || "");
  const [salary, setSalary] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [departments, setDepartments] = useState(initialDepts);
  const [roles, setRoles] = useState(initialRoles);

  const [newDeptName, setNewDeptName] = useState("");
  const [addingDept, setAddingDept] = useState(false);
  const [savingDept, setSavingDept] = useState(false);

  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  async function createDept() {
    if (!newDeptName.trim()) return;
    setSavingDept(true);
    const res = await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDeptName.trim() }) });
    const data = await res.json();
    if (res.ok) { setDepartments(prev => [...prev, data.department]); setDepartmentId(data.department.id); setNewDeptName(""); setAddingDept(false); }
    setSavingDept(false);
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    setSavingRole(true);
    const res = await fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newRoleName.trim() }) });
    const data = await res.json();
    if (res.ok) { setRoles(prev => [...prev, data.role]); setRoleId(data.role.id); setNewRoleName(""); setAddingRole(false); }
    setSavingRole(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/invite", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || null, departmentId: departmentId || null, roleId: roleId || null,
        salary: salary ? Number(salary) : null, hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null, contractStart: contractStart || null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
    setSuccess(autoApprove ? `Invite sent to ${email}!` : `Invitation created — pending your approval.`);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div className="text-3xl mb-3">✉️</div>
          <h2 className="text-lg font-bold mb-1">Done!</h2>
          <p className="text-sm text-gray-500 mb-6">{success}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSuccess(""); setEmail(""); setName(""); }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              Invite another
            </button>
            <Link href="/invitations"
              className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
              View invitations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <Link href="/invitations" className="text-sm text-gray-400 hover:text-gray-700 mb-4 inline-block transition-colors">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Invite employee</h1>
      {!autoApprove && (
        <p className="text-sm text-amber-600 mb-4">Your invitation will need owner approval before the email is sent.</p>
      )}

      <div className="bg-white rounded-2xl p-6 mt-4 space-y-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 transition-colors"
            placeholder="omer@restaurant.com" />
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 transition-colors"
            placeholder="Omer Cohen" />
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Department</label>
          {addingDept ? (
            <div className="flex gap-2">
              <input autoFocus type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createDept(); } if (e.key === "Escape") setAddingDept(false); }}
                placeholder="e.g. Kitchen"
                className="flex-1 border border-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none" />
              <button type="button" onClick={createDept} disabled={savingDept}
                className="px-3 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {savingDept ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setAddingDept(false)}
                className="px-3 py-2.5 text-gray-400 hover:text-gray-700 text-sm transition-colors">✕</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 bg-white transition-colors">
                <option value="">No department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingDept(true)}
                className="px-3 py-2.5 border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-800 text-sm font-semibold rounded-xl transition-colors" title="New department">
                + New
              </button>
            </div>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
          {addingRole ? (
            <div className="flex gap-2">
              <input autoFocus type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createRole(); } if (e.key === "Escape") setAddingRole(false); }}
                placeholder="e.g. Manager"
                className="flex-1 border border-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none" />
              <button type="button" onClick={createRole} disabled={savingRole}
                className="px-3 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {savingRole ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setAddingRole(false)}
                className="px-3 py-2.5 text-gray-400 hover:text-gray-700 text-sm transition-colors">✕</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={roleId} onChange={e => setRoleId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 bg-white transition-colors">
                <option value="">No role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingRole(true)}
                className="px-3 py-2.5 border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-800 text-sm font-semibold rounded-xl transition-colors" title="New role">
                + New
              </button>
            </div>
          )}
        </div>

        {/* Contract */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Contract details (optional)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Hours / week</label>
              <input type="number" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 transition-colors" placeholder="40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Salary (€)</label>
              <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 transition-colors" placeholder="2400" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Contract start</label>
              <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-800 transition-colors" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="button" onClick={handleSubmit} disabled={loading || !email}
          className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? "Sending…" : autoApprove ? "Send invitation" : "Submit for approval"}
        </button>
      </div>
    </div>
  );
}
