import { getSupabaseAdmin } from "./supabase-admin";

export type TwinMode = "learning" | "socialization";

export async function getTwinDynamicVariables(mode: TwinMode) {
  const userId = process.env.MARTIN_USER_ID ?? "martin";
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return {
      mode,
      user_name: "Martin",
      public_memory_context: "",
      private_learning_context: "",
      conversation_goal: getConversationGoal(mode),
    };
  }

  const { data: profile } = await supabase
    .from("memory_profiles")
    .select(
      "public_context, private_context, values_summary, career_summary, project_summary, management_philosophy, personal_story_summary"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const publicContext = [
    profile?.public_context,
    profile?.career_summary,
    profile?.project_summary,
    profile?.values_summary,
    profile?.management_philosophy,
  ]
    .filter(Boolean)
    .join("\n\n");

  const privateContext =
    mode === "learning"
      ? [
          profile?.private_context,
          profile?.personal_story_summary,
          profile?.career_summary,
          profile?.project_summary,
          profile?.values_summary,
          profile?.management_philosophy,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";

  return {
    mode,
    user_name: "Martin",
    public_memory_context: publicContext,
    private_learning_context: privateContext,
    conversation_goal: getConversationGoal(mode),
  };
}

function getConversationGoal(mode: TwinMode) {
  if (mode === "learning") {
    return "Interview Martin to learn more about his life, career, projects, values, management philosophy, and current perspectives.";
  }

  return "Answer visitors' questions about Martin using only approved public context.";
}
