import { NextResponse } from "next/server";
import { z } from "zod";
import { getTwinDynamicVariables, type TwinMode } from "@/lib/twin-context";

const requestSchema = z.object({
  mode: z.enum(["learning", "socialization"]).default("socialization"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { mode } = requestSchema.parse(body);
  const dynamicVariables = await getTwinDynamicVariables(mode as TwinMode);
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return NextResponse.json({
    agent_id: agentId,
    dynamic_variables: dynamicVariables,
  });
}
