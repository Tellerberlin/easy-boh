import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { permissions } = await req.json();
  const admin = await createAdminClient();

  const { data: role, error } = await admin
    .from("roles")
    .update({ permissions })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ role });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await createAdminClient();
  await admin.from("roles").delete().eq("id", id).eq("is_owner", false);
  return NextResponse.json({ ok: true });
}
