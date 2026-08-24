import { z } from 'zod';
import { OrderType, PaymentType, OrderStatus } from '../../types/order.enums.js';

export const createZoneSchema = z.object({
  name: z.string().min(2, 'Zone name must be at least 2 characters.'),
  code: z.string().min(2, 'Zone code must be at least 2 characters.'),
  minLat: z.number().optional(),
  maxLat: z.number().optional(),
  minLng: z.number().optional(),
  maxLng: z.number().optional(),
});

export const createAreaSchema = z.object({
  name: z.string().min(2, 'Area name is required.'),
  pincode: z.string().length(6, 'Pincode must be exactly 6 digits.'),
  zoneId: z.string().uuid('Invalid Zone ID.'),
});

export const bulkCsvSchema = z.object({
  mappings: z.array(
    z.object({
      name: z.string(),
      pincode: z.string().length(6),
      zoneId: z.string().uuid(),
    })
  ).min(1, 'At least one pincode mapping must be provided.'),
});

export const updateRateCardSchema = z.object({
  baseFare: z.number().min(0, 'Base fare cannot be negative.'),
  baseWeightKg: z.number().gt(0, 'Base weight slab must be greater than 0 kg.'),
  perKgRate: z.number().min(0, 'Per kg rate cannot be negative.'),
  minCharge: z.number().min(0, 'Minimum charge cannot be negative.'),
});

export const updateSurchargeSchema = z.object({
  surchargeType: z.enum(['FLAT', 'PERCENTAGE']),
  surchargeValue: z.number().min(0, 'Surcharge value cannot be negative.'),
});

export const manualAssignSchema = z.object({
  agentUserId: z.string().uuid('Invalid Agent User ID.'),
});

export const overrideStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().min(3, 'Override notes are required for administrative audit logs.'),
});

export const createOnBehalfOrderSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID.'),
  pickupAddress: z.string().min(5, 'Pickup address is required.'),
  dropAddress: z.string().min(5, 'Drop address is required.'),
  lengthCm: z.number().positive('Length must be positive.'),
  widthCm: z.number().positive('Width must be positive.'),
  heightCm: z.number().positive('Height must be positive.'),
  actualWeightKg: z.number().positive('Actual weight must be positive.'),
  orderType: z.nativeEnum(OrderType),
  paymentType: z.nativeEnum(PaymentType),
  pickupPincode: z.string().length(6).optional(),
  dropPincode: z.string().length(6).optional(),
});
