import { createClient } from "@/lib/supabase/server";
import RolesClient from "./RolesClient";

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("profile_id", user.id)
    .single();

  if (!me) return null;

  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("restaurant_id", me.restaurant_id)
    .order("is_owner", { ascending: false });

  return <RolesClient roles={roles || []} />;
}
