import { protectedProcedure, router } from "../_core/trpc";
import type { Message } from "../_core/llm";
import { onceLLM } from "../credits/metered-llm";
import { idempotencyKeySchema } from "../credits/key-schema";
import { z } from "zod";

/**
 * Features Router - Multi-feature endpoints
 * 
 * Provides endpoints for:
 * - Video generation and editing
 * - Music generation
 * - Document processing
 * - Finance tracking
 * - Automation workflows
 */

export const featuresRouter = router({
  /**
   * Generate video from prompt
   */
  generateVideo: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        prompt: z.string().min(1, "Prompt required"),
        duration: z.number().optional(),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a video generation assistant. Create a detailed video script and storyboard based on the user's prompt.
Return as JSON with script, scenes, and technical specifications.`,
          },
          {
            role: "user",
            content: `Generate a video with these specs:
Prompt: ${input.prompt}
Duration: ${input.duration || 60} seconds
Style: ${input.style || "Professional"}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.features.generateVideo", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
          responseFormat: { type: "json_object" },
        });

        const video = result.choices[0]?.message?.content;
        if (!video) throw new Error("Failed to generate video");

        return {
          success: true,
          video: typeof video === "string" ? JSON.parse(video) : video,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Video generation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to generate video"
        );
      }
    }),

  /**
   * Generate music from prompt
   */
  generateMusic: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        prompt: z.string().min(1, "Prompt required"),
        genre: z.string().optional(),
        duration: z.number().optional(),
        tempo: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a music generation assistant. Create a detailed music composition specification.
Return as JSON with instrument details, chord progressions, and technical specs.`,
          },
          {
            role: "user",
            content: `Generate music with these specs:
Prompt: ${input.prompt}
Genre: ${input.genre || "Electronic"}
Duration: ${input.duration || 120} seconds
Tempo: ${input.tempo || 120} BPM`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.features.generateMusic", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 1024,
          responseFormat: { type: "json_object" },
        });

        const music = result.choices[0]?.message?.content;
        if (!music) throw new Error("Failed to generate music");

        return {
          success: true,
          music: typeof music === "string" ? JSON.parse(music) : music,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Music generation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to generate music"
        );
      }
    }),

  /**
   * Process and analyze documents
   */
  processDocument: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        content: z.string(),
        action: z.enum(["summarize", "extract", "analyze", "translate"]),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const actionPrompts: Record<string, string> = {
          summarize: "Provide a concise summary of the document.",
          extract: "Extract key information and entities from the document.",
          analyze: "Analyze the document for insights and patterns.",
          translate: `Translate the document to ${input.language || "English"}.`,
        };

        const messages: Message[] = [
          {
            role: "system",
            content: `You are a document processing assistant. ${actionPrompts[input.action]}`,
          },
          {
            role: "user",
            content: input.content,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.features.processDocument", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
        });

        const processed = result.choices[0]?.message?.content;
        if (!processed) throw new Error("Failed to process document");

        return {
          success: true,
          result: typeof processed === "string" ? processed : JSON.stringify(processed),
          action: input.action,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Document processing error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to process document"
        );
      }
    }),

  /**
   * Track finances and generate reports
   */
  trackFinance: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        transactions: z.array(z.object({
          date: z.string(),
          description: z.string(),
          amount: z.number(),
          category: z.string(),
          type: z.enum(["income", "expense"]),
        })),
        timeframe: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a financial analyst. Analyze transactions and provide insights.
Return as JSON with summary, categories, trends, and recommendations.`,
          },
          {
            role: "user",
            content: `Analyze these transactions for ${input.timeframe || "this month"}:
${input.transactions.map((t) => `${t.date}: ${t.description} - ${t.type} $${t.amount} (${t.category})`).join("\n")}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.features.trackFinance", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 1024,
          responseFormat: { type: "json_object" },
        });

        const analysis = result.choices[0]?.message?.content;
        if (!analysis) throw new Error("Failed to analyze finances");

        return {
          success: true,
          analysis: typeof analysis === "string" ? JSON.parse(analysis) : analysis,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Finance tracking error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to track finances"
        );
      }
    }),

  /**
   * Create automation workflows
   */
  createWorkflow: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        name: z.string(),
        trigger: z.string(),
        actions: z.array(z.string()),
        conditions: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a workflow automation expert. Design an automation workflow.
Return as JSON with detailed steps and error handling.`,
          },
          {
            role: "user",
            content: `Create an automation workflow:
Name: ${input.name}
Trigger: ${input.trigger}
Actions: ${input.actions.join(", ")}
Conditions: ${input.conditions?.join(", ") || "None"}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.features.createWorkflow", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 1024,
          responseFormat: { type: "json_object" },
        });

        const workflow = result.choices[0]?.message?.content;
        if (!workflow) throw new Error("Failed to create workflow");

        return {
          success: true,
          workflow: typeof workflow === "string" ? JSON.parse(workflow) : workflow,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Workflow creation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to create workflow"
        );
      }
    }),
});
