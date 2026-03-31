import { z } from 'zod'

export const TaskStatus = z.enum(['backlog', 'doing', 'done', 'blocked'])

export const taskInsertSchema = z.object({
  title: z.string().min(1, 'Título obrigatório').max(255),
  description: z.string().max(2000).optional(),
  status: TaskStatus,
  order_index: z.number().int().min(0),
  user_id: z.string().uuid(),
  priority: z.enum(['low', 'medium', 'high']),
})

export const taskUpdateSchema = z.object({
  title: z.string().min(1, 'Título obrigatório').max(255),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().nullable().optional(),
})

export const reminderInsertSchema = z.object({
  user_id: z.string().uuid(),
  lead_name: z.string().min(1, 'Nome obrigatório').max(255),
  reminder_type: z.string().min(1).max(100),
  reminder_time: z.string().datetime({ message: 'Data/hora inválida' }),
  notes: z.string().max(2000).optional(),
})

export type TaskInsert = z.infer<typeof taskInsertSchema>
export type TaskUpdate = z.infer<typeof taskUpdateSchema>
export type ReminderInsert = z.infer<typeof reminderInsertSchema>
