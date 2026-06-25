import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  password: z.string().min(1),
});

type TranscriptItem = {
  role?: unknown;
  message?: unknown;
  source?: unknown;
  created_at?: unknown;
};

type ConversationRow = {
  id: string;
  elevenlabs_conversation_id: string | null;
  user_id: string;
  mode: string;
  visitor_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  transcript: unknown;
};

type AdminTranscriptItem = {
  role: string;
  message: string;
  created_at: string | null;
};

function isWithin(dateValue: string | null, since: Date) {
  if (!dateValue) {
    return false;
  }

  return new Date(dateValue).getTime() >= since.getTime();
}

function getVisitorName(row: ConversationRow) {
  return row.visitor_id?.trim() || "Unknown visitor";
}

function getTranscript(row: ConversationRow): TranscriptItem[] {
  return Array.isArray(row.transcript) ? (row.transcript as TranscriptItem[]) : [];
}

function countDistinctVisitors(rows: ConversationRow[]) {
  return new Set(rows.map(getVisitorName)).size;
}

function summarizeWindow(rows: ConversationRow[], since: Date) {
  const windowRows = rows.filter((row) => isWithin(row.created_at, since));
  const withMessages = windowRows.filter((row) => getTranscript(row).length > 0);

  return {
    conversations: windowRows.length,
    visitors: countDistinctVisitors(windowRows),
    with_messages: withMessages.length,
    messages: withMessages.reduce((total, row) => total + getTranscript(row).length, 0),
  };
}

function getPreview(row: ConversationRow) {
  const transcript = getTranscript(row);
  const firstVisitorMessage = transcript.find((item) => item.role === "visitor" || item.role === "user");
  const firstTwinMessage = transcript.find((item) => item.role === "twin" || item.role === "agent");

  return {
    visitor: typeof firstVisitorMessage?.message === "string" ? firstVisitorMessage.message : "",
    twin: typeof firstTwinMessage?.message === "string" ? firstTwinMessage.message : "",
  };
}

function getAdminTranscript(row: ConversationRow): AdminTranscriptItem[] {
  return getTranscript(row)
    .map((item) => ({
      role: typeof item.role === "string" ? item.role : "message",
      message: typeof item.message === "string" ? item.message : "",
      created_at: typeof item.created_at === "string" ? item.created_at : null,
    }))
    .filter((item) => item.message.trim().length > 0);
}

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!configuredPassword) {
    return NextResponse.json({ error: "Admin dashboard password is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Dashboard password is required." }, { status: 400 });
  }

  const { password } = parsedBody.data;

  if (password !== configuredPassword) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("conversations")
    .select("id, elevenlabs_conversation_id, user_id, mode, visitor_id, created_at, started_at, ended_at, transcript")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Unable to load admin statistics." }, { status: 500 });
  }

  const rows = (data ?? []) as ConversationRow[];
  const recent = rows.map((row) => {
    const transcript = getTranscript(row);
    return {
      id: row.id,
      visitor_name: getVisitorName(row),
      mode: row.mode,
      created_at: row.created_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
      is_active: !row.ended_at,
      message_count: transcript.length,
      preview: getPreview(row),
      transcript: getAdminTranscript(row),
    };
  });

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    windows: {
      last_hour: summarizeWindow(rows, oneHourAgo),
      last_24_hours: summarizeWindow(rows, twentyFourHoursAgo),
      last_7_days: summarizeWindow(rows, sevenDaysAgo),
    },
    totals: {
      loaded_conversations: rows.length,
      active_conversations: rows.filter((row) => !row.ended_at).length,
      distinct_visitors_7_days: countDistinctVisitors(rows),
    },
    recent,
  });
}
