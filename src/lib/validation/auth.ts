import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, "min_8")
  .max(72)
  .regex(/[a-zA-Z]/, "needs_letter")
  .regex(/[0-9]/, "needs_number");

export const fullNameSchema = z.string().trim().min(2).max(120);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
