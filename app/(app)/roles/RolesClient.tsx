"use client";
import { useState } from "react";
import type { Role, Permissions } from "@/lib/types";

const ALL_PERMISSIONS: { key: keyof Permissions; label: string; description: string }[] = [
  { key: "can_invite", label: "Invite employees", description: "Send invitations to new employees" },
  { key: "can_approve_invitations", label: "Approve invitations", description: "Send invites without owner review" },
  { key: "can_approve_shifts", label: "Approve shifts", description: "Approve or reject pending shifts" },
  { key: "can_edit_shifts", label: "Edit shifts", description: "Edit clock in/out times" },
  { key: "can_view_all_shifts", label: "View all shifts", description: "See all employees' time records" },
  { key: "can_manage_departments", label: "Manage departments", description: "Create and remove departments" },
  { key: "can_manage_roles", label: "Manage roles", description: "Create and edit roles & permissions" },
];

export default function RolesClient({ roles: initial }: { roles: Role[] }) {
  const [roles, setRoles] = useState(initial);
  const [newRoleName, setNewRoleName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Permissions>({});
  const [saving, setSaving] = useState(false);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setAdding(true);
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setRoles(prev => [...prev, data.role]);
      setNewRoleName("");
    }
    setAdding(false);
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditPerms({ ...role.permissions });
  }

  async function saveEdit(roleId: string) {
    setSaving(true);
    const res = await fetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: editPerms }),
    });
    const data = await res.json();
    if (res.ok) {
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: data.role.permissions } : r));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function deleteRole(id: string) {
    await fetch(`/api/roles/${id}`, { method: "DELETE" });
    setRoles(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="px-8 py-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-6">Roles & Permissions</h1>

      <form onSubmit={addRole} className="flex gap-3 mb-6">
        <input
          type="text"
          value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
          placeholder="New role name (e.g. Kitchen Manager)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={adding || !newRoleName.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add role"}
        </button>
      </form>

      <div className="space-y-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{role.name}</span>
                {role.is_owner && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    Owner
                  </span>
                )}
              </div>
              {!role.is_owner && (
                <div className="flex gap-2">
                  {editingId === role.id ? (
                    <>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(role.id)}
                        disabled={saving}
                        className="bg-indigo-600 text-white text-sm px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(role)}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Edit permissions
                      </button>
                      <button
                        onClick={() => deleteRole(role.id)}
                        className="text-sm text-gray-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {role.is_owner ? (
              <p className="text-xs text-gray-400">Owner has all permissions by default.</p>
            ) : editingId === role.id ? (
              <div className="space-y-2">
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editPerms[p.key]}
                      onChange={e => setEditPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">{p.label}</span>
                      <p className="text-xs text-gray-400">{p.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ALL_PERMISSIONS.filter(p => role.permissions[p.key]).length === 0 ? (
                  <span className="text-xs text-gray-400">No permissions</span>
                ) : ALL_PERMISSIONS.filter(p => role.permissions[p.key]).map(p => (
                  <span key={p.key} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {p.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
