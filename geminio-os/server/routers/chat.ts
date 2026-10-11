import { protectedProcedure, router } from "../_core/trpc";
import type { Message } from "../_core/llm";
import { onceLLM } from "../credits/metered-llm";
import { idempotencyKeySchema } from "../credits/key-schema";
import { z } from "zod";

/**
 * Chat extras (merged from geminio-os-master-latest).
 * sendMessage lives in server/routers.ts (gateway-backed, persisted).
 * These procedures are authenticated because they consume LLM budget.
 */
export const chatExtrasRouter = router({
  summarizeConversation: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        conversationHistory: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a conversation summarizer. Provide a brief, concise summary of the conversation in 2-3 sentences.
Focus on the main topics and any decisions or actions mentioned.`,
          },
          {
            role: "user",
            content: `Please summarize this conversation:\n\n${input.conversationHistory
              .map((msg) => `${msg.role}: ${msg.content}`)
              .join("\n")}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.chat.summarizeConversation", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 256,
        });

        const summary = result.choices[0]?.message?.content;
        if (!summary) {
          throw new Error("No summary generated");
        }

        return {
          success: true,
          summary: typeof summary === "string" ? summary : JSON.stringify(summary),
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Summarize error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to summarize conversation"
        );
      }
    }),

  /**
   * Extract action items from conversation
   * Identifies tasks, goals, or actions mentioned in the conversation
   */
  extractActionItems: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        conversationHistory: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are an action item extractor. Extract any tasks, goals, or action items mentioned in the conversation.
Return a JSON array of action items with the following structure:
[
  {
    "description": "Brief description of the action",
    "priority": "high" | "medium" | "low",
    "dueDate": "ISO date string or null if not specified"
  }
]`,
          },
          {
            role: "user",
            content: `Extract action items from this conversation:\n\n${input.conversationHistory
              .map((msg) => `${msg.role}: ${msg.content}`)
              .join("\n")}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.chat.extractActionItems", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 512,
          responseFormat: { type: "json_object" },
        });

        const actionItems = result.choices[0]?.message?.content;
        if (!actionItems) {
          throw new Error("No action items extracted");
        }

        return {
          success: true,
          actionItems: typeof actionItems === "string" ? JSON.parse(actionItems) : actionItems,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Extract action items error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to extract action items"
        );
      }
    }),
});
