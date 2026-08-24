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

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export interface Zone {
  id: string;
  name: string;
  code: string;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  total_areas?: number;
  active_agents?: number;
}

export interface RateCard {
  id: string;
  order_type: OrderType;
  is_intra_zone: boolean;
  base_fare: number | string;
  base_weight_kg: number | string;
  per_kg_rate: number | string;
  min_charge: number | string;
}

export interface SurchargeConfig {
  id: string;
  order_type: OrderType;
  surcharge_type: 'FLAT' | 'PERCENTAGE';
  surcharge_value: number | string;
}

export interface OrderHistoryItem {
  id: string;
  previous_status?: OrderStatus;
  new_status: OrderStatus;
  actor_role: UserRole;
  actor_name?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export interface Order {
  id: string;
  tracking_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  pickup_address: string;
  drop_address: string;
  pickup_zone?: string;
  drop_zone?: string;
  pickup_zone_name?: string;
  drop_zone_name?: string;
  actual_weight_kg: number;
  volumetric_weight_kg: number;
  chargeable_weight_kg: number;
  order_type: OrderType;
  payment_type: PaymentType;
  base_charge?: number;
  weight_charge?: number;
  cod_surcharge?: number;
  total_charge: number;
  status: OrderStatus;
  assigned_agent_id?: string;
  agent_name?: string;
  agent_phone?: string;
  rescheduled_date?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteBreakdown {
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
  pickupZone?: string;
  dropZone?: string;
}
