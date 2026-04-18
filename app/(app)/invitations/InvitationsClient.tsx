"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Invitation {
  id: string; email: string; name: string | null; status: string; created_at: string;
  expires_at: string | null;
  department: { name: string } | null; role: { name: string } | null;
  invited_by_profile: { name: string | null } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending_approval: "bg-amber-50 text-amber-700",
  approved:         "bg-blue-50 text-blue-700",
  sent:             "bg-blue-50 text-blue-700",
  accepted:         "bg-green-50 text-green-700",
  expired:          "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  expired: "Expired",
};

function resolveStatus(inv: Invitation): string {
  if (inv.status === "accepted") return "accepted";
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return "expired";
  return inv.status;
}

export default function InvitationsClient({ invitations, canApprove }: {
  invitations: Invitation[]; canApprove: boolean;
}) {
  const router = useRouter();
  const [approving, setApproving] = useState<string | null>(null);
  const [reinviting, setReinviting] = useState<string | null>(null);
  const [reinviteError, setReinviteError] = useState<Record<string, string>>({});

  async function handleApprove(id: string) {
    setApproving(id);
    const res = await fetch("/api/approve-invitation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId: id }),
    });
    if (res.ok) router.refresh();
    setApproving(null);
  }

  async function handleReinvite(id: string) {
    setReinviting(id);
    setReinviteError(prev => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/invitations/${id}/resend`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setReinviteError(prev => ({ ...prev, [id]: data.error || "Failed to send" }));
    }
    setReinviting(null);
  }

  const pendingCount = invitations.filter(i => resolveStatus(i) === "pending_approval").length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Invitations</h1>
          {canApprove && pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">{pendingCount} pending approval</p>
          )}
        </div>
        <Link href="/invitations/new"
          className="bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors">
          + Invite employee
        </Link>
      </div>

      {invitations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="text-gray-400 text-sm">No invitations yet. Invite your first team member!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100">
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-3 py-3">Name</th>
                <th className="text-left px-3 py-3">Department</th>
                <th className="text-left px-3 py-3">Role</th>
                <th className="text-left px-3 py-3">Invited by</th>
                <th className="text-left px-3 py-3">Date</th>
                <th className="text-center px-3 py-3">Status</th>
                {canApprove && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv, i) => {
                const status = resolveStatus(inv);
                return (
                  <tr key={inv.id}
                    className={`group ${i < invitations.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
                    <td className={`px-5 py-3.5 font-semibold ${status === "expired" ? "text-gray-400" : ""}`}>{inv.email}</td>
                    <td className="px-3 py-3.5 text-gray-500">{inv.name || "—"}</td>
                    <td className="px-3 py-3.5 text-gray-500">{inv.department?.name || "—"}</td>
                    <td className="px-3 py-3.5 text-gray-500">{inv.role?.name || "—"}</td>
                    <td className="px-3 py-3.5 text-gray-500">{inv.invited_by_profile?.name || "—"}</td>
                    <td className="px-3 py-3.5 text-gray-400 text-xs">
                      {new Date(inv.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[status] || status}
                      </span>
                    </td>
                    {canApprove && (
                      <td className="px-5 py-3.5 text-right">
                        {status === "pending_approval" && (
                          <button onClick={() => handleApprove(inv.id)} disabled={approving === inv.id}
                            className="text-xs text-gray-500 hover:text-gray-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100">
                            {approving === inv.id ? "…" : "Approve & send"}
                          </button>
                        )}
                        {status === "expired" && (
                          <div className="flex flex-col items-end gap-0.5">
                            <button
                              onClick={() => handleReinvite(inv.id)}
                              disabled={reinviting === inv.id}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                            >
                              {reinviting === inv.id ? "Sending…" : "Re-invite"}
                            </button>
                            {reinviteError[inv.id] && (
                              <span className="text-xs text-red-500 px-3">{reinviteError[inv.id]}</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
