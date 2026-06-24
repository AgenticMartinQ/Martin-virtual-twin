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

  return NextResponse.json({
    dynamic_variables: dynamicVariables,
  });
}
