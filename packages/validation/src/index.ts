import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  address: z.string().min(3).max(500),
  passportNumber: z.string().min(5).max(30),
  aadhaarNumber: z.string().min(8).max(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAccuracy: z.number().min(0).optional(),
  consentVersion: z.string().min(1).default('v1'),
  principalAmount: z.number().positive().optional(),
  dailyPayment: z.number().positive().optional(),
});

export const createRepaymentSchema = z.object({
  amount: z.number().positive(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(10).max(128),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'COLLECTOR']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateRepaymentInput = z.infer<typeof createRepaymentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
