import { z } from 'zod';

export const healthPlanOnboardingSchema = z.object({
  goal: z.enum(['strength', 'energy', 'body_composition', 'mobility', 'endurance', 'general_health']),
  baselineActivity: z.enum(['low', 'some', 'irregular', 'active']),
  availableTime: z.enum(['15', '30', '45_60']),
  preferences: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  equipment: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  knownLimitations: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  safetySignals: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const healthPlanStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'left']),
});

export type HealthPlanOnboardingInput = z.infer<typeof healthPlanOnboardingSchema>;
