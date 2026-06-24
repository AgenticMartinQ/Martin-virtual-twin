import { NextResponse } from "next/server";
import { z } from "zod";
import { getTwinDynamicVariables, type TwinMode } from "@/lib/twin-context";

const requestSchema = z.object({
  mode: z.enum(["learning", "socialization"]).default("socialization"),
  visitorName: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { mode, visitorName } = requestSchema.parse(body);
  const dynamicVariables = await getTwinDynamicVariables(mode as TwinMode);
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "";
  const visitorId = visitorName ? visitorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";

  return NextResponse.json({
    agent_id: agentId,
    voice_id: voiceId,
    dynamic_variables: {
      ...dynamicVariables,
      visitor_name: visitorName ?? "",
      visitor_id: visitorId,
    },
  });
}
