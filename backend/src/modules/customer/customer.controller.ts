import { Request, Response } from 'express';
import { query } from '../../config/database.js';
import { RateService } from '../../core/rate-engine/rate.service.js';
import { ZoneService } from '../../core/zone/zone.service.js';
import { AssignmentService } from '../../core/assignment/assignment.service.js';
import { OrderLifecycleService } from '../../core/lifecycle/fsm.js';
import { NotificationService } from '../../core/notifications/notification.service.js';
import { OrderStatus, UserRole } from '../../types/order.enums.js';

export class CustomerController {
  /**
   * POST /api/customer/orders/quote
   * Live pre-confirmation price quote calculation
   */
  static async calculateQuote(req: Request, res: Response): Promise<void> {
    try {
      const {
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        orderType,
        paymentType,
        pickupPincode,
        dropPincode,
      } = req.body;

      // 1. Resolve Pickup & Drop Zones
      const pickupZone = await ZoneService.resolveZone(undefined, pickupPincode);
      const dropZone = await ZoneService.resolveZone(undefined, dropPincode);

      // 2. Compute itemized rate breakdown via Rate Engine
      const quote = await RateService.calculateOrderCharge({
        dimensions: { lengthCm, widthCm, heightCm },
        actualWeightKg,
        orderType,
        paymentType,
        pickupZoneId: pickupZone.zoneId,
        dropZoneId: dropZone.zoneId,
      });

      res.status(200).json({
        success: true,
        data: {
          ...quote,
          pickupZone: pickupZone.zoneName,
          dropZone: dropZone.zoneName,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Quote calculation failed.',
      });
    }
  }

  /**
   * POST /api/customer/orders/create
   * Customer places order, triggers auto-assignment & emits notifications
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const {
        pickupAddress,
        dropAddress,
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        orderType,
        paymentType,
        pickupPincode,
        dropPincode,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
      } = req.body;

      // 1. Resolve Zones
      const pickupCoords = pickupLat && pickupLng ? { latitude: pickupLat, longitude: pickupLng } : undefined;
      const dropCoords = dropLat && dropLng ? { latitude: dropLat, longitude: dropLng } : undefined;

      const pickupZone = await ZoneService.resolveZone(pickupCoords, pickupPincode);
      const dropZone = await ZoneService.resolveZone(dropCoords, dropPincode);

      // 2. Calculate Rate
      const quote = await RateService.calculateOrderCharge({
        dimensions: { lengthCm, widthCm, heightCm },
        actualWeightKg,
        orderType,
        paymentType,
        pickupZoneId: pickupZone.zoneId,
        dropZoneId: dropZone.zoneId,
      });

      // 3. Generate Tracking Code
      const trackingNumber = `TRK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 4. Insert Order into PostgreSQL
      const insertSql = `
        INSERT INTO orders (
          tracking_number, customer_id, pickup_address, drop_address,
          pickup_lat, pickup_lng, drop_lat, drop_lng,
          pickup_zone_id, drop_zone_id, length_cm, width_cm, height_cm,
          actual_weight_kg, volumetric_weight_kg, chargeable_weight_kg,
          order_type, payment_type, base_charge, weight_charge, cod_surcharge, total_charge, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'CREATED')
        RETURNING id, tracking_number, status, created_at;
      `;

      const orderRes = await query<{ id: string; tracking_number: string; created_at: Date }>(insertSql, [
        trackingNumber,
        customerId,
        pickupAddress,
        dropAddress,
        pickupLat || null,
        pickupLng || null,
        dropLat || null,
        dropLng || null,
        pickupZone.zoneId,
        dropZone.zoneId,
        lengthCm,
        widthCm,
        heightCm,
        actualWeightKg,
        quote.volumetricWeightKg,
        quote.chargeableWeightKg,
        orderType,
        paymentType,
        quote.baseFare,
        quote.weightCharge,
        quote.codSurcharge,
        quote.totalCharge,
      ]);

      const newOrder = orderRes.rows[0];

      // 5. Log Initial Status Event in Immutable History
      await OrderLifecycleService.transitionStatus({
        orderId: newOrder.id,
        newStatus: OrderStatus.CREATED,
        changedByUserId: customerId,
        actorRole: UserRole.CUSTOMER,
        notes: 'Order placed by customer.',
      });

      // 6. Trigger Spatial Auto-Assignment Engine
      const assigned = await AssignmentService.findNearestAvailableAgent(pickupCoords, pickupZone.zoneId);

      if (assigned) {
        await query(`UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED' WHERE id = $2;`, [
          assigned.agentUserId,
          newOrder.id,
        ]);
        await query(`UPDATE agent_profiles SET status = 'BUSY' WHERE user_id = $1;`, [assigned.agentUserId]);

        await OrderLifecycleService.transitionStatus({
          orderId: newOrder.id,
          newStatus: OrderStatus.ASSIGNED,
          changedByUserId: customerId,
          actorRole: UserRole.CUSTOMER,
          notes: `Auto-assigned to agent ${assigned.agentName}.`,
        });
      }

      // 7. Trigger Non-blocking Email & SMS Notification
      const userRes = await query<{ email: string; phone: string }>(`SELECT email, phone FROM users WHERE id = $1;`, [customerId]);
      if (userRes.rowCount! > 0) {
        NotificationService.notifyOrderStatusChange({
          customerEmail: userRes.rows[0].email,
          customerPhone: userRes.rows[0].phone,
          trackingNumber: newOrder.tracking_number,
          newStatus: assigned ? OrderStatus.ASSIGNED : OrderStatus.CREATED,
          notes: `Order created successfully. Total fare: $${quote.totalCharge}`,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Order created successfully.',
        data: {
          orderId: newOrder.id,
          trackingNumber: newOrder.tracking_number,
          status: assigned ? OrderStatus.ASSIGNED : OrderStatus.CREATED,
          quote,
          assignedAgent: assigned || null,
        },
      });
    } catch (error: any) {
      console.error('Create Order Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Order creation failed.',
      });
    }
  }

  /**
   * GET /api/customer/orders
   * List logged-in customer's orders
   */
  static async listMyOrders(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const sql = `
        SELECT 
          o.id,
          o.tracking_number,
          o.pickup_address,
          o.drop_address,
          pz.name as pickup_zone,
          dz.name as drop_zone,
          o.actual_weight_kg,
          o.volumetric_weight_kg,
          o.chargeable_weight_kg,
          o.order_type,
          o.payment_type,
          o.total_charge,
          o.status,
          o.assigned_agent_id,
          agent.name as agent_name,
          agent.phone as agent_phone,
          o.rescheduled_date,
          o.created_at,
          o.updated_at
        FROM orders o
        LEFT JOIN zones pz ON o.pickup_zone_id = pz.id
        LEFT JOIN zones dz ON o.drop_zone_id = dz.id
        LEFT JOIN users agent ON o.assigned_agent_id = agent.id
        WHERE o.customer_id = $1
        ORDER BY o.created_at DESC;
      `;
      const result = await query(sql, [customerId]);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/customer/orders/:id/reschedule
   * Failed delivery reschedule flow: captures new date & triggers agent reassignment
   */
  static async rescheduleFailedOrder(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const { id } = req.params;
      const { rescheduledDate, notes } = req.body;

      // 1. Verify order belongs to customer and status is FAILED
      const orderRes = await query<{ status: OrderStatus; pickup_zone_id: string; tracking_number: string }>(
        `SELECT status, pickup_zone_id, tracking_number FROM orders WHERE id = $1 AND customer_id = $2;`,
        [id, customerId]
      );

      if (orderRes.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }

      if (orderRes.rows[0].status !== OrderStatus.FAILED) {
        res.status(400).json({
          success: false,
          error: `Only orders marked as FAILED can be rescheduled. Current status: ${orderRes.rows[0].status}`,
        });
        return;
      }

      // 2. Update Order Status to RESCHEDULED & set rescheduled_date
      await query(
        `UPDATE orders SET status = 'RESCHEDULED', rescheduled_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [new Date(rescheduledDate), id]
      );

      // 3. Log Immutable History Ledger Event
      await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: OrderStatus.RESCHEDULED,
        changedByUserId: customerId,
        actorRole: UserRole.CUSTOMER,
        notes: `Customer rescheduled delivery for ${rescheduledDate}. ${notes || ''}`,
      });

      // 4. Trigger Agent Reassignment Engine
      const assigned = await AssignmentService.findNearestAvailableAgent(undefined, orderRes.rows[0].pickup_zone_id);
      if (assigned) {
        await query(`UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED' WHERE id = $2;`, [
          assigned.agentUserId,
          id,
        ]);
        await query(`UPDATE agent_profiles SET status = 'BUSY' WHERE user_id = $1;`, [assigned.agentUserId]);

        await OrderLifecycleService.transitionStatus({
          orderId: id,
          newStatus: OrderStatus.ASSIGNED,
          changedByUserId: customerId,
          actorRole: UserRole.CUSTOMER,
          notes: `Reassigned to agent ${assigned.agentName} for rescheduled attempt.`,
        });
      }

      // 5. Emit Email & SMS Confirmation
      const userRes = await query<{ email: string; phone: string }>(`SELECT email, phone FROM users WHERE id = $1;`, [customerId]);
      if (userRes.rowCount! > 0) {
        NotificationService.notifyOrderStatusChange({
          customerEmail: userRes.rows[0].email,
          customerPhone: userRes.rows[0].phone,
          trackingNumber: orderRes.rows[0].tracking_number,
          newStatus: OrderStatus.RESCHEDULED,
          notes: `Delivery rescheduled for ${rescheduledDate}.`,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order rescheduled successfully.',
        data: {
          rescheduledDate,
          reassignedAgent: assigned || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/customer/analytics
   * Returns authenticated customer's order stats
   */
  static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const sql = `
        SELECT 
          COUNT(*)::int as total_orders,
          COUNT(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END)::int as in_transit,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as delivered,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed,
          COUNT(CASE WHEN status = 'RESCHEDULED' THEN 1 END)::int as rescheduled
        FROM orders
        WHERE customer_id = $1;
      `;
      const result = await query(sql, [customerId]);
      const row = result.rows[0];
      res.status(200).json({
        success: true,
        data: {
          totalOrders: row.total_orders || 0,
          inTransit: row.in_transit || 0,
          delivered: row.delivered || 0,
          failed: row.failed || 0,
          rescheduled: row.rescheduled || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
