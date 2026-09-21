import { z } from "zod";

import {
  STRONG_PASSWORD_MESSAGE,
  isStrongPassword,
} from "@/lib/auth/password-policy";
import { normalizeMobile } from "@/lib/contacts/mobile";

const strongPassword = z
  .string()
  .max(128)
  .refine(isStrongPassword, { message: STRONG_PASSWORD_MESSAGE });

const organizationSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must use lowercase letters, numbers, and hyphens",
  );

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  /** Optional - generated from organization name when omitted (public signup). */
  organizationSlug: organizationSlugSchema.optional(),
  /** Optional - defaults to Asia/Kolkata when omitted. */
  timezone: z.string().trim().min(1).max(100).optional(),
  adminName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  /** Indian mobile; required by the signup form, optional here so service callers can omit it. */
  mobile: z.string().trim().min(10).max(16).optional(),
  password: strongPassword,
  /** Optional vendor referral code (attribution only; signup stays open). */
  referralCode: z.string().trim().max(32).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

const unifiedIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((identifier) => {
    if (z.string().email().safeParse(identifier).success) return true;
    try {
      normalizeMobile(identifier);
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid email or Indian mobile number");

export const unifiedLoginSchema = z
  .object({
    identifier: unifiedIdentifierSchema.optional(),
    // Backward-compatible email-only field for existing API clients.
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((input) => Boolean(input.identifier) !== Boolean(input.email), {
    message: "Provide one email or Indian mobile number",
    path: ["identifier"],
  })
  .transform((input) => ({
    identifier: input.identifier ?? input.email!,
    password: input.password,
  }));

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: strongPassword,
});

export const vendorRegistrationSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    contactName: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), {
        message: "Contact name must not contain control characters",
      }),
    email: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((email) => email.toLowerCase())
      .optional(),
    password: strongPassword,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UnifiedLoginInput = z.infer<typeof unifiedLoginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VendorRegistrationInput = z.infer<
  typeof vendorRegistrationSchema
>;
