import { z } from 'zod';
import { OrderType, PaymentType } from '../../types/order.enums.js';

export const orderQuoteSchema = z.object({
  lengthCm: z.number().positive('Length must be positive.'),
  widthCm: z.number().positive('Width must be positive.'),
  heightCm: z.number().positive('Height must be positive.'),
  actualWeightKg: z.number().positive('Actual weight must be positive.'),
  orderType: z.nativeEnum(OrderType),
  paymentType: z.nativeEnum(PaymentType),
  pickupPincode: z.string().length(6, 'Pickup pincode must be 6 digits.').optional(),
  dropPincode: z.string().length(6, 'Drop pincode must be 6 digits.').optional(),
});

export const createOrderSchema = z.object({
  pickupAddress: z.string().min(5, 'Pickup address must be at least 5 characters.'),
  dropAddress: z.string().min(5, 'Drop address must be at least 5 characters.'),
  lengthCm: z.number().positive('Length must be positive.'),
  widthCm: z.number().positive('Width must be positive.'),
  heightCm: z.number().positive('Height must be positive.'),
  actualWeightKg: z.number().positive('Actual weight must be positive.'),
  orderType: z.nativeEnum(OrderType),
  paymentType: z.nativeEnum(PaymentType),
  pickupPincode: z.string().length(6, 'Pickup pincode must be 6 digits.').optional(),
  dropPincode: z.string().length(6, 'Drop pincode must be 6 digits.').optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export const rescheduleOrderSchema = z.object({
  rescheduledDate: z.string().min(10, 'A valid reschedule date (YYYY-MM-DD) is required.'),
  notes: z.string().optional(),
});
