import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ElevenLabsWebhookEvent = {
  type?: string;
  event_timestamp?: number;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    status?: string;
    user_id?: string;
    transcript?: unknown[];
    metadata?: {
      start_time_unix_secs?: number;
      call_duration_secs?: number;
    };
    analysis?: {
      transcript_summary?: string;
      data_collection_results?: Record<string, unknown>;
    };
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, unknown>;
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("elevenlabs-signature");
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  const allowUnsignedWebhook = process.env.NODE_ENV !== "production";

  let event: ElevenLabsWebhookEvent;

  if (webhookSecret) {
    if (!signature) {
      return NextResponse.json({ error: "Missing ElevenLabs signature" }, { status: 401 });
    }

    try {
      const elevenlabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      event = (await elevenlabs.webhooks.constructEvent(rawBody, signature, webhookSecret)) as ElevenLabsWebhookEvent;
    } catch {
      return NextResponse.json({ error: "Invalid ElevenLabs signature" }, { status: 401 });
    }
  } else if (allowUnsignedWebhook) {
    event = JSON.parse(rawBody) as ElevenLabsWebhookEvent;
  } else {
    return NextResponse.json({ error: "ElevenLabs webhook secret is not configured" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  if (supabase && event.type === "post_call_transcription" && event.data?.conversation_id) {
    const dynamicVariables = event.data.conversation_initiation_client_data?.dynamic_variables ?? {};
    const mode = dynamicVariables.mode === "learning" ? "learning" : "socialization";
    const userId = process.env.MARTIN_USER_ID ?? "martin";
    const visitorName = typeof dynamicVariables.visitor_name === "string" ? dynamicVariables.visitor_name : null;
    const databaseConversationId =
      typeof dynamicVariables.database_conversation_id === "string" ? dynamicVariables.database_conversation_id : null;

    const webhookConversationData = {
      elevenlabs_conversation_id: event.data.conversation_id,
      user_id: userId,
      mode,
      visitor_id: visitorName,
      transcript: event.data.transcript ?? [],
      raw_payload: event,
      started_at: event.data.metadata?.start_time_unix_secs
        ? new Date(event.data.metadata.start_time_unix_secs * 1000).toISOString()
        : null,
      ended_at: event.event_timestamp ? new Date(event.event_timestamp * 1000).toISOString() : null,
    };

    const { data: conversation, error } = databaseConversationId
      ? await supabase
          .from("conversations")
          .update(webhookConversationData)
          .eq("id", databaseConversationId)
          .select("id")
          .single()
      : await supabase
          .from("conversations")
          .upsert(webhookConversationData, { onConflict: "elevenlabs_conversation_id" })
          .select("id")
          .single();

    if (error) {
      return NextResponse.json({ error: "Unable to save conversation" }, { status: 500 });
    }

    const dataCollection = event.data.analysis?.data_collection_results;
    const transcriptSummary = event.data.analysis?.transcript_summary;

    if (conversation?.id && (dataCollection || transcriptSummary)) {
      await supabase.from("memories").insert({
        user_id: userId,
        category: "conversation_summary",
        title: `Conversation ${event.data.conversation_id}`,
        content: transcriptSummary ?? JSON.stringify(dataCollection),
        source_conversation_id: conversation.id,
        confidence: 0.5,
        visibility: mode === "learning" ? "private" : "restricted",
        status: "pending",
      });
    }
  }

  return NextResponse.json({ status: "received" });
}
