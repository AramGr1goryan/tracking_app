import { z } from 'zod';

export const employeeSchema = z.object({
  fullName: z.string().trim().min(1, 'Укажите имя сотрудника').max(120),
  position: z.string().trim().max(120).optional().transform((value) => value || null),
});

export const startTimerSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  taskDescription: z.string().trim().min(1, 'Укажите описание задачи').max(500),
});

export const reportQuerySchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  employeeId: z.coerce.number().int().positive().optional(),
}).refine((value) => value.startDate <= value.endDate, {
  message: 'Дата начала должна быть не позже даты окончания',
});

export const entriesQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  date: z.string().date().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});