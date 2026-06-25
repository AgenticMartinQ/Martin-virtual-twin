import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(["visitor", "twin"]),
  text: z.string().trim().min(1).max(12000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { conversationId, role, text } = requestSchema.parse(body);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { data: conversation, error: readError } = await supabase
    .from("conversations")
    .select("transcript")
    .eq("id", conversationId)
    .single();

  if (readError) {
    return NextResponse.json({ error: "Conversation record was not found." }, { status: 404 });
  }

  const transcript = Array.isArray(conversation.transcript) ? conversation.transcript : [];

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      transcript: [
        ...transcript,
        {
          role,
          message: text,
          source: "website",
          created_at: new Date().toISOString(),
        },
      ],
    })
    .eq("id", conversationId);

  if (updateError) {
    return NextResponse.json({ error: "Unable to save conversation turn." }, { status: 500 });
  }

  return NextResponse.json({ status: "saved" });
}
