import { createClient, createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import MemberActions from "./MemberActions";
import MemberInfoClient from "./MemberInfoClient";
import MemberShiftsClient from "./MemberShiftsClient";
import MemberMergeButton from "./MemberMergeButton";
import HoursBalanceClient from "./HoursBalanceClient";
import ContractDetailsClient from "./ContractDetailsClient";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = await createAdminClient();

  // Get current user + their role
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentMember } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role:roles(is_owner)")
    .eq("profile_id", user!.id)
    .single();
  const currentRole = currentMember?.role as { is_owner: boolean } | null;
  const isOwner = !!currentRole?.is_owner;

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("id, profile_id, restaurant_id, role_id, salary, hours_per_week, days_per_week, vacation_days_per_year, sick_days, contract_start, contract_end, created_at, profile:profiles(name, phone, address, birthdate, is_placeholder), role:roles(id, name, is_owner, permissions)")
    .eq("profile_id", id)
    .single();


  if (!member) return <div className="px-8 py-6 text-gray-500">Member not found.</div>;

  const profile = member.profile as { name: string | null; phone: string | null; address: string | null; birthdate: string | null; is_placeholder: boolean } | null;
  const role = member.role as { id: string; name: string; is_owner: boolean } | null;

  // Get email from auth.users (only available server-side with admin)
  const { data: authUser } = await admin.auth.admin.getUserById(id);
  const email = authUser?.user?.email ?? null;

  // Load all roles for the dropdown (owner only)
  const { data: allRoles } = isOwner
    ? await supabase.from("roles").select("id, name").eq("restaurant_id", currentMember!.restaurant_id)
    : { data: null };

  // Load real (non-placeholder) employees for the merge dropdown
  const { data: realMembers } = profile?.is_placeholder && isOwner
    ? await admin
        .from("restaurant_members")
        .select("profile_id, profile:profiles(name, is_placeholder)")
        .eq("restaurant_id", currentMember!.restaurant_id)
        .neq("profile_id", id)
    : { data: null };

  const mergeableEmployees = (realMembers || [])
    .filter((m: { profile_id: string; profile: { name: string | null; is_placeholder: boolean } | null }) =>
      !m.profile?.is_placeholder
    )
    .map((m: { profile_id: string; profile: { name: string | null; is_placeholder: boolean } | null }) => ({
      profile_id: m.profile_id,
      name: m.profile?.name ?? null,
    }))
    .sort((a: { name: string | null }, b: { name: string | null }) =>
      (a.name || "").localeCompare(b.name || "")
    );

  // Find the most recent shift to know which month to open by default
  const { data: latestShift } = await supabase
    .from("time_records")
    .select("clocked_in_at")
    .eq("profile_id", id)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = latestShift?.clocked_in_at ? new Date(latestShift.clocked_in_at) : new Date();
  const initialYear  = latestDate.getFullYear();
  const initialMonth = latestDate.getMonth();

  // Load shifts for that month
  const monthStart = new Date(initialYear, initialMonth, 1).toISOString();
  const monthEnd   = new Date(initialYear, initialMonth + 1, 0, 23, 59, 59).toISOString();
  const { data: initialShifts } = await supabase
    .from("time_records")
    .select("id, profile_id, clocked_in_at, clocked_out_at, status, notes")
    .eq("profile_id", id)
    .gte("clocked_in_at", monthStart)
    .lte("clocked_in_at", monthEnd)
    .order("clocked_in_at", { ascending: false });

  const { data: deptMemberships } = await supabase
    .from("department_members")
    .select("*, department:departments(name)")
    .eq("profile_id", id);

  // Load all shifts from contract start (or earliest available) for the hours balance calculation
  const balanceFrom = member.contract_start
    ? new Date(member.contract_start).toISOString()
    : new Date(new Date().getFullYear() - 2, 0, 1).toISOString(); // fallback: 2 years ago
  const { data: allShifts } = await supabase
    .from("time_records")
    .select("clocked_in_at, clocked_out_at, status")
    .eq("profile_id", id)
    .gte("clocked_in_at", balanceFrom)
    .order("clocked_in_at", { ascending: false });


  return (
    <div className="px-8 py-6 max-w-4xl">
      <Link href="/team" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Back to team
      </Link>

      {/* Placeholder / imported employee banner */}
      {profile?.is_placeholder && isOwner && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-amber-800">Imported record — no account yet</p>
              <p className="text-xs text-amber-600 mt-0.5">
                This employee was created from a CSV import. You can invite them by adding an email below, or merge their shifts into an existing employee.
              </p>
            </div>
            <MemberMergeButton
              placeholderId={id}
              placeholderName={profile?.name ?? null}
              employees={mergeableEmployees}
            />
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{profile?.name || "—"}</h1>
          <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            role?.is_owner ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
          }`}>
            {role?.name || "—"}
          </span>
        </div>
        {isOwner && id !== user!.id && (
          <MemberActions
            profileId={id}
            currentRoleId={role?.id || ""}
            roles={(allRoles || []) as { id: string; name: string }[]}
            contractEnd={member.contract_end ?? null}
          />
        )}
      </div>

      {/* Personal info */}
      <MemberInfoClient
        profileId={id}
        canEdit={isOwner}
        isPlaceholder={profile?.is_placeholder ?? false}
        initial={{
          name: profile?.name ?? null,
          email,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          birthdate: profile?.birthdate ?? null,
        }}
      />

      {/* Contract details */}
      <ContractDetailsClient
        profileId={id}
        canEdit={isOwner}
        initial={{
          hoursPerWeek:        member.hours_per_week ?? null,
          daysPerWeek:         (member as { days_per_week?: number | null }).days_per_week ?? null,
          vacationDaysPerYear: (member as { vacation_days_per_year?: number | null }).vacation_days_per_year ?? null,
          salary:              member.salary ? Number(member.salary) : null,
          contractStart:       member.contract_start ?? null,
          contractEnd:         member.contract_end ?? null,
        }}
      />

      {/* Departments */}
      {(deptMemberships || []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Departments</h2>
          <div className="flex flex-wrap gap-2">
            {deptMemberships!.map(dm => {
              const dept = dm.department as { name: string } | null;
              return (
                <span key={dm.id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {dept?.name || "—"}{dm.is_manager ? " (manager)" : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <HoursBalanceClient
        profileId={id}
        canEdit={isOwner}
        contractStart={member.contract_start ?? null}
        contractEnd={member.contract_end ?? null}
        hoursPerWeek={member.hours_per_week ?? null}
        daysPerWeek={(member as { days_per_week?: number | null }).days_per_week ?? null}
        vacationDaysPerYear={(member as { vacation_days_per_year?: number | null }).vacation_days_per_year ?? null}
        initialSickDays={Number((member as { sick_days?: number | null }).sick_days ?? 0)}
        allShifts={(allShifts || []) as { clocked_in_at: string; clocked_out_at: string | null; status: string }[]}
      />

      <MemberShiftsClient
        profileId={id}
        currentUserId={user!.id}
        canEdit={isOwner}
        initialYear={initialYear}
        initialMonth={initialMonth}
        initialShifts={initialShifts || []}
      />
    </div>
  );
}
