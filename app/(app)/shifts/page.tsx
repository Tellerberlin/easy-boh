import { createClient } from "@/lib/supabase/server";
import ShiftsClient from "./ShiftsClient";

export default async function ShiftsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role:roles(is_owner, permissions)")
    .eq("profile_id", user.id)
    .single();

  if (!member) return null;

  const role = member.role as { is_owner: boolean; permissions: Record<string, boolean> };
  const canViewAll = role.is_owner || role.permissions?.can_view_all_shifts;
  const canApprove = role.is_owner || role.permissions?.can_approve_shifts;
  const canEdit = role.is_owner || role.permissions?.can_edit_shifts;

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("restaurant_id", member.restaurant_id);

  // Load team members + their profiles server-side (avoids client RLS join issues)
  const { data: teamMembers } = canViewAll
    ? await supabase
        .from("restaurant_members")
        .select("profile_id, profile:profiles(name)")
        .eq("restaurant_id", member.restaurant_id)
    : { data: null };

  // Build a map profileId → name to pass to client
  const profilesMap: Record<string, string> = {};
  (teamMembers || []).forEach((m: { profile_id: string; profile: { name: string | null } | null }) => {
    profilesMap[m.profile_id] = m.profile?.name || m.profile_id;
  });

  return (
    <ShiftsClient
      currentUserId={user.id}
      restaurantId={member.restaurant_id}
      canViewAll={!!canViewAll}
      canApprove={!!canApprove}
      canEdit={!!canEdit}
      departments={departments || []}
      teamMembers={(teamMembers || []).map((m: { profile_id: string; profile: { name: string | null } | null }) => ({
        profile_id: m.profile_id,
        name: m.profile?.name || null,
      }))}
      profilesMap={profilesMap}
    />
  );
}
