import { z } from "zod";

const wordCount = (max: number) =>
  z.string().refine((s) => s.trim().split(/\s+/).length <= max, {
    message: `Maximum ${max} words`,
  });

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const inflectionScanSchema = z.object({
  companyUrl: z.string().url("Must be a valid URL"),
  companyName: z.string().optional(),
  priorities: z
    .array(wordCount(15).pipe(z.string().min(1, "Priority is required")))
    .length(3, "Exactly 3 priorities required"),
  workflow: z.object({
    name: z.string().min(1, "Workflow name is required"),
    steps: z
      .array(z.string().min(1, "Step cannot be empty"))
      .min(1, "At least 1 step")
      .max(5, "Maximum 5 steps"),
  }),
  competitors: z
    .array(z.string().url("Must be a valid URL"))
    .length(3, "Exactly 3 competitors required"),
});

export const competitorTeardownSchema = z.object({
  companyName: z.string().min(1, "Competitor name is required"),
  companyUrl: z.string().url("Must be a valid URL"),
  userQuestion: z.string().max(200).optional(),
});

export const selfScanSchema = z.object({
  companyUrl: z.string().url("Must be a valid URL"),
  icp: z.string().min(1, "ICP is required").max(200, "Keep to 1 sentence"),
  priorities: z
    .array(z.string().min(1, "Priority cannot be empty"))
    .length(3, "Exactly 3 priorities required"),
  bigBet: z.string().min(1, "Big bet is required").max(200),
  aiAmbition: z.string().min(1, "AI ambition is required").max(200),
  competitors: z
    .array(z.string().url("Must be a valid URL"))
    .length(3, "Exactly 3 competitor URLs required"),
  selfWeakness: z.string().max(400, "Keep to 2 bullets").optional(),
});

export const dealDDSchema = z.object({
  companyUrl: z.string().url("Must be a valid URL"),
  investmentThesis: z
    .string()
    .optional()
    .refine((s) => !s || s.trim().split(/\s+/).length <= 200, {
      message: "Maximum 200 words",
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InflectionScanInput = z.infer<typeof inflectionScanSchema>;
export type CompetitorTeardownInput = z.infer<typeof competitorTeardownSchema>;
export type SelfScanInput = z.infer<typeof selfScanSchema>;
export type DealDDInput = z.infer<typeof dealDDSchema>;
