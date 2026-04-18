import { createClient } from "@/lib/supabase/server";
import InvitationsClient from "./InvitationsClient";

export default async function InvitationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role:roles(is_owner, permissions)")
    .eq("profile_id", user.id)
    .single();

  if (!me) return null;
  const role = me.role as { is_owner: boolean; permissions: Record<string, boolean> };
  const canApprove = role.is_owner || role.permissions?.can_approve_invitations;

  const { data: invitations } = await supabase
    .from("invitations")
    .select("*, department:departments(name), role:roles(name), invited_by_profile:profiles!invitations_invited_by_fkey(name)")
    .eq("restaurant_id", me.restaurant_id)
    .order("created_at", { ascending: false });

  return (
    <InvitationsClient
      invitations={invitations || []}
      canApprove={!!canApprove}
      currentUserId={user.id}
    />
  );
}
