import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { conversationId } = requestSchema.parse(body);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      ended_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    return NextResponse.json({ error: "Unable to mark conversation ended." }, { status: 500 });
  }

  return NextResponse.json({ status: "ended" });
}
