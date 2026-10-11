import { protectedProcedure, router } from "../_core/trpc";
import type { Message } from "../_core/llm";
import { onceLLM } from "../credits/metered-llm";
import { idempotencyKeySchema } from "../credits/key-schema";
import { z } from "zod";

/**
 * Jobs Router - AI Job Assistant Endpoints
 * 
 * Provides endpoints for:
 * - Job search and filtering
 * - Resume generation
 * - Cover letter drafting
 * - Application tracking
 * - Interview preparation
 */

export const jobsRouter = router({
  /**
   * Search for job opportunities
   */
  searchJobs: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        query: z.string().min(1, "Search query required"),
        location: z.string().optional(),
        jobType: z.enum(["full-time", "part-time", "contract", "remote"]).optional(),
        salaryMin: z.number().optional(),
        salaryMax: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a job search assistant. Find and recommend job opportunities based on the user's criteria.
Return results as a JSON array with the following structure:
[
  {
    "title": "Job Title",
    "company": "Company Name",
    "location": "Location",
    "jobType": "full-time|part-time|contract|remote",
    "salary": "Salary range or null",
    "description": "Brief description",
    "matchScore": 0-100,
    "url": "Job posting URL or null"
  }
]`,
          },
          {
            role: "user",
            content: `Search for jobs with these criteria:
Query: ${input.query}
Location: ${input.location || "Any"}
Job Type: ${input.jobType || "Any"}
Salary Range: ${input.salaryMin || "Any"} - ${input.salaryMax || "Any"}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.jobs.searchJobs", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
          responseFormat: { type: "json_object" },
        });

        const jobs = result.choices[0]?.message?.content;
        if (!jobs) {
          throw new Error("No jobs found");
        }

        return {
          success: true,
          jobs: typeof jobs === "string" ? JSON.parse(jobs) : jobs,
          count: Array.isArray(jobs) ? jobs.length : 0,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Job search error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to search jobs"
        );
      }
    }),

  /**
   * Generate a resume based on user information
   */
  generateResume: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        fullName: z.string(),
        email: z.string(),
        phone: z.string().optional(),
        summary: z.string().optional(),
        experience: z.array(z.object({
          company: z.string(),
          position: z.string(),
          duration: z.string(),
          description: z.string(),
        })).optional(),
        education: z.array(z.object({
          school: z.string(),
          degree: z.string(),
          field: z.string(),
          year: z.string(),
        })).optional(),
        skills: z.array(z.string()).optional(),
        jobTitle: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a professional resume writer. Create a well-formatted, ATS-friendly resume based on the provided information.
Return the resume as a formatted text document with clear sections.`,
          },
          {
            role: "user",
            content: `Generate a professional resume with the following information:
Name: ${input.fullName}
Email: ${input.email}
Phone: ${input.phone || "Not provided"}
Target Position: ${input.jobTitle || "Not specified"}
Professional Summary: ${input.summary || "Not provided"}

Experience:
${input.experience?.map((exp) => `- ${exp.position} at ${exp.company} (${exp.duration}): ${exp.description}`).join("\n") || "Not provided"}

Education:
${input.education?.map((edu) => `- ${edu.degree} in ${edu.field} from ${edu.school} (${edu.year})`).join("\n") || "Not provided"}

Skills:
${input.skills?.join(", ") || "Not provided"}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.jobs.generateResume", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
        });

        const resume = result.choices[0]?.message?.content;
        if (!resume) {
          throw new Error("Failed to generate resume");
        }

        return {
          success: true,
          resume: typeof resume === "string" ? resume : JSON.stringify(resume),
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Resume generation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to generate resume"
        );
      }
    }),

  /**
   * Generate a cover letter
   */
  generateCoverLetter: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        fullName: z.string(),
        jobTitle: z.string(),
        companyName: z.string(),
        companyDescription: z.string().optional(),
        relevantExperience: z.string(),
        keySkills: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are a professional cover letter writer. Create a compelling, personalized cover letter that highlights the candidate's relevant experience and skills.`,
          },
          {
            role: "user",
            content: `Generate a cover letter with the following information:
Candidate Name: ${input.fullName}
Job Title: ${input.jobTitle}
Company: ${input.companyName}
Company Description: ${input.companyDescription || "Not provided"}
Relevant Experience: ${input.relevantExperience}
Key Skills: ${input.keySkills?.join(", ") || "Not provided"}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.jobs.generateCoverLetter", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 1024,
        });

        const coverLetter = result.choices[0]?.message?.content;
        if (!coverLetter) {
          throw new Error("Failed to generate cover letter");
        }

        return {
          success: true,
          coverLetter: typeof coverLetter === "string" ? coverLetter : JSON.stringify(coverLetter),
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Cover letter generation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to generate cover letter"
        );
      }
    }),

  /**
   * Prepare application responses
   */
  prepareApplicationResponses: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        jobTitle: z.string(),
        companyName: z.string(),
        questions: z.array(z.string()),
        relevantExperience: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are an expert at helping candidates prepare application responses. Provide thoughtful, concise answers to application questions.
Return responses as a JSON object with question-answer pairs.`,
          },
          {
            role: "user",
            content: `Prepare application responses for:
Job: ${input.jobTitle} at ${input.companyName}
Relevant Experience: ${input.relevantExperience}

Questions:
${input.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.jobs.prepareApplicationResponses", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
          responseFormat: { type: "json_object" },
        });

        const responses = result.choices[0]?.message?.content;
        if (!responses) {
          throw new Error("Failed to prepare responses");
        }

        return {
          success: true,
          responses: typeof responses === "string" ? JSON.parse(responses) : responses,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Prepare responses error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to prepare responses"
        );
      }
    }),

  /**
   * Prepare for interview
   */
  prepareInterview: protectedProcedure
    .input(
      z.object({ idempotencyKey: idempotencyKeySchema.optional(),
        jobTitle: z.string(),
        companyName: z.string(),
        companyInfo: z.string().optional(),
        relevantExperience: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const messages: Message[] = [
          {
            role: "system",
            content: `You are an interview coach. Provide comprehensive interview preparation including likely questions, tips, and talking points.
Return as a JSON object with sections for questions, tips, and talking points.`,
          },
          {
            role: "user",
            content: `Prepare me for an interview for:
Job: ${input.jobTitle} at ${input.companyName}
Company Info: ${input.companyInfo || "Not provided"}
My Experience: ${input.relevantExperience}`,
          },
        ];

        const result = await onceLLM(ctx.user.id, "legacy.jobs.prepareInterview", input.idempotencyKey, {
          messages,
          model: "gpt-4o-mini",
          maxTokens: 2048,
          responseFormat: { type: "json_object" },
        });

        const preparation = result.choices[0]?.message?.content;
        if (!preparation) {
          throw new Error("Failed to prepare interview");
        }

        return {
          success: true,
          preparation: typeof preparation === "string" ? JSON.parse(preparation) : preparation,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Interview preparation error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to prepare interview"
        );
      }
    }),
});
