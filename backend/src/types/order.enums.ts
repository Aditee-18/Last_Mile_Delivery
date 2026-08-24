export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  DELIVERY_AGENT = 'DELIVERY_AGENT',
}

export enum OrderType {
  B2B = 'B2B',
  B2C = 'B2C',
}

export enum PaymentType {
  PREPAID = 'PREPAID',
  COD = 'COD',
}

export enum AgentStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RESCHEDULED = 'RESCHEDULED',
}

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RateCalculationInput {
  dimensions: Dimensions;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  pickupZoneId: string;
  dropZoneId: string;
}

export interface RateCalculationBreakdown {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  isIntraZone: boolean;
  baseFare: number;
  baseWeightKg: number;
  perKgRate: number;
  weightCharge: number;
  codSurcharge: number;
  totalCharge: number;
}
