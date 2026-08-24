import { z } from 'zod';
import { AgentStatus, OrderStatus } from '../../types/order.enums.js';

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Invalid latitude coordinates.'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude coordinates.'),
  status: z.nativeEnum(AgentStatus).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
});

export const failOrderSchema = z.object({
  reasonNotes: z.string().min(5, 'A detailed reason is required when flagging a delivery failure.'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
