import { NextResponse } from "next/server";
import { z } from "zod";
import { getTwinDynamicVariables, type TwinMode } from "@/lib/twin-context";

const requestSchema = z.object({
  mode: z.enum(["learning", "socialization"]).default("socialization"),
  visitorName: z.string().trim().min(1).max(80).optional(),
});

async function getConversationToken(agentId: string, participantName?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return "";
  }

  const tokenUrl = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  tokenUrl.searchParams.set("agent_id", agentId);

  if (participantName) {
    tokenUrl.searchParams.set("participant_name", participantName);
  }

  const response = await fetch(tokenUrl, {
    headers: {
      "xi-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to create ElevenLabs conversation token (${response.status}). ${detail}`.trim());
  }

  const data = (await response.json()) as { token?: unknown };

  if (typeof data.token !== "string" || !data.token) {
    throw new Error("ElevenLabs did not return a conversation token.");
  }

  return data.token;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { mode, visitorName } = requestSchema.parse(body);
  const dynamicVariables = await getTwinDynamicVariables(mode as TwinMode);
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "";
  const visitorId = visitorName ? visitorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";

  if (!agentId) {
    return NextResponse.json({ error: "ElevenLabs agent ID is not configured." }, { status: 500 });
  }

  let conversationToken = "";

  try {
    conversationToken = await getConversationToken(agentId, visitorName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare the ElevenLabs session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    agent_id: agentId,
    conversation_token: conversationToken,
    voice_id: voiceId,
    dynamic_variables: {
      ...dynamicVariables,
      visitor_name: visitorName ?? "",
      visitor_id: visitorId,
    },
  });
}
