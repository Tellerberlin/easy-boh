import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("profile_id", user.id)
    .single();

  if (!me) return null;

  const { data: rawMembers } = await supabase
    .from("restaurant_members")
    .select("id, profile_id, hours_per_week, salary, contract_start, contract_end, created_at, profile:profile_id(name, is_placeholder), role:roles(name, is_owner)")
    .eq("restaurant_id", me.restaurant_id)
    .order("created_at", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const members = (rawMembers || []).sort((a, b) => {
    const aDeactivated = !!a.contract_end && a.contract_end <= today;
    const bDeactivated = !!b.contract_end && b.contract_end <= today;
    return Number(aDeactivated) - Number(bDeactivated);
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">{(members || []).length} members</p>
        </div>
        <Link href="/invitations/new"
          className="bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors">
          + Invite employee
        </Link>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100">
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-3 py-3">Role</th>
              <th className="text-left px-3 py-3">Hours / week</th>
              <th className="text-left px-3 py-3">Salary</th>
              <th className="text-left px-3 py-3">Contract start</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const profile = m.profile as { name: string | null; is_placeholder: boolean } | null;
              const role = m.role as { name: string; is_owner: boolean } | null;
              const isDeactivated = !!m.contract_end && m.contract_end <= today;
              return (
                <tr key={m.id}
                  className={`group ${i < members.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
                  <td className="px-5 py-3.5 font-semibold">
                    <Link href={`/team/${m.profile_id}`} className="hover:text-indigo-600 transition-colors inline-flex items-center gap-2">
                      <span className={isDeactivated ? "text-gray-400" : ""}>{profile?.name || <span className="text-gray-400 font-normal italic">No name</span>}</span>
                      {isDeactivated && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-500">deactivated</span>
                      )}
                      {profile?.is_placeholder && !isDeactivated && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">imported</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      role?.is_owner ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {role?.name || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-gray-500">{m.hours_per_week ? `${m.hours_per_week}h` : "—"}</td>
                  <td className="px-3 py-3.5 text-gray-500">{m.salary ? `€${Number(m.salary).toLocaleString("de-DE")}` : "—"}</td>
                  <td className="px-3 py-3.5 text-gray-500">
                    {m.contract_start ? new Date(m.contract_start).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/team/${m.profile_id}`}
                      className="text-xs text-gray-400 hover:text-gray-900 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
