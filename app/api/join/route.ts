import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const admin = await createAdminClient();

  // Validate invitation
  const { data: invitation } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });
  if (invitation.status === "accepted") return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  if (invitation.status === "pending_approval") return NextResponse.json({ error: "This invitation has not been approved yet" }, { status: 403 });
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  const email = invitation.email as string;
  const placeholderProfileId: string | null = invitation.placeholder_profile_id ?? null;

  // Check if auth user already exists for this email
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;

  if (existingUser) {
    // Update password on existing account
    const { error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    userId = existingUser.id;
  } else {
    // Create new auth user with confirmed email
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: invitation.name },
    });
    if (createErr || !newUser.user) return NextResponse.json({ error: createErr?.message || "Failed to create account" }, { status: 500 });
    userId = newUser.user.id;
  }

  // ── Placeholder profile migration ──────────────────────────────
  // If this invitation was linked to a placeholder profile (created via CSV import),
  // migrate all their data to the real auth user UUID, then delete the placeholder.
  if (placeholderProfileId && placeholderProfileId !== userId) {
    // Migrate time_records
    await admin
      .from("time_records")
      .update({ profile_id: userId })
      .eq("profile_id", placeholderProfileId);

    // Migrate department_members
    await admin
      .from("department_members")
      .update({ profile_id: userId })
      .eq("profile_id", placeholderProfileId);

    // Grab placeholder profile name (to preserve it if the real profile has none)
    const { data: placeholderProfile } = await admin
      .from("profiles")
      .select("name")
      .eq("id", placeholderProfileId)
      .single();

    // Delete placeholder restaurant_members row (we'll upsert the real one below)
    await admin
      .from("restaurant_members")
      .delete()
      .eq("profile_id", placeholderProfileId);

    // Delete placeholder profile
    await admin.from("profiles").delete().eq("id", placeholderProfileId);

    // Ensure real profile has the name from the placeholder (if not already set)
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    const nameToUse = existingProfile?.name || placeholderProfile?.name || invitation.name || null;
    await admin.from("profiles").upsert({
      id: userId,
      name: nameToUse,
      is_placeholder: false,
    });
  } else {
    // Ensure profile exists with name
    await admin.from("profiles").upsert({
      id: userId,
      name: invitation.name || null,
      is_placeholder: false,
    });
  }

  // Determine role
  let roleId = invitation.role_id;
  if (!roleId) {
    const { data: defaultRole } = await admin
      .from("roles")
      .select("id")
      .eq("restaurant_id", invitation.restaurant_id)
      .eq("name", "Employee")
      .maybeSingle();
    roleId = defaultRole?.id || null;
  }
  if (!roleId) {
    const { data: anyRole } = await admin
      .from("roles")
      .select("id")
      .eq("restaurant_id", invitation.restaurant_id)
      .limit(1)
      .single();
    roleId = anyRole?.id || null;
  }
  if (!roleId) return NextResponse.json({ error: "No role found for this restaurant" }, { status: 500 });

  // Add to restaurant_members
  const { error: memberErr } = await admin.from("restaurant_members").upsert({
    restaurant_id: invitation.restaurant_id,
    profile_id: userId,
    role_id: roleId,
    salary: invitation.salary,
    hours_per_week: invitation.hours_per_week,
    contract_start: invitation.contract_start,
  }, { onConflict: "restaurant_id,profile_id" });

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  // Add to department if specified
  if (invitation.department_id) {
    await admin.from("department_members").upsert({
      department_id: invitation.department_id,
      profile_id: userId,
      is_manager: false,
    }, { onConflict: "department_id,profile_id" });
  }

  // Mark invitation accepted
  await admin.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

  return NextResponse.json({ ok: true, email });
}
