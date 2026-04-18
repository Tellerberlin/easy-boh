import { createClient } from "@/lib/supabase/server";
import NewInvitationClient from "./NewInvitationClient";

export default async function NewInvitationPage() {
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
  const autoApprove = role.is_owner || !!role.permissions?.can_approve_invitations;

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("restaurant_id", me.restaurant_id);

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, is_owner")
    .eq("restaurant_id", me.restaurant_id);

  return (
    <NewInvitationClient
      departments={departments || []}
      roles={(roles || []).filter(r => !r.is_owner)}
      autoApprove={autoApprove}
    />
  );
}
