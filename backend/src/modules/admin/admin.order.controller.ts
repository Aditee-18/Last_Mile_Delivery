import { Request, Response } from 'express';
import { query } from '../../config/database.js';
import { RateService } from '../../core/rate-engine/rate.service.js';
import { ZoneService } from '../../core/zone/zone.service.js';
import { AssignmentService } from '../../core/assignment/assignment.service.js';
import { OrderLifecycleService } from '../../core/lifecycle/fsm.js';
import { NotificationService } from '../../core/notifications/notification.service.js';
import { OrderStatus, UserRole } from '../../types/order.enums.js';

export class AdminOrderController {
  /**
   * GET /api/admin/orders
   * Filtered & paginated order search (by status, zoneId, agentId, or tracking number)
   */
  static async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const { status, zoneId, agentId, search, page = 1, limit = 10 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const conditions: string[] = [];
      const params: any[] = [];

      if (status) {
        params.push(status);
        conditions.push(`o.status = $${params.length}`);
      }

      if (zoneId) {
        params.push(zoneId);
        conditions.push(`(o.pickup_zone_id = $${params.length} OR o.drop_zone_id = $${params.length})`);
      }

      if (agentId) {
        params.push(agentId);
        conditions.push(`o.assigned_agent_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(o.tracking_number ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `
        SELECT COUNT(*)::int as total
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        ${whereClause};
      `;
      const countRes = await query<{ total: number }>(countSql, params);

      params.push(Number(limit));
      const limitParamIdx = params.length;
      params.push(offset);
      const offsetParamIdx = params.length;

      const dataSql = `
        SELECT 
          o.id,
          o.tracking_number,
          o.customer_id,
          u.name as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          o.pickup_address,
          o.drop_address,
          pz.name as pickup_zone_name,
          dz.name as drop_zone_name,
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
        LEFT JOIN users u ON o.customer_id = u.id
        LEFT JOIN zones pz ON o.pickup_zone_id = pz.id
        LEFT JOIN zones dz ON o.drop_zone_id = dz.id
        LEFT JOIN users agent ON o.assigned_agent_id = agent.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
      `;

      const dataRes = await query(dataSql, params);

      res.status(200).json({
        success: true,
        data: {
          orders: dataRes.rows,
          pagination: {
            total: countRes.rows[0].total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(countRes.rows[0].total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/orders/:id/assign
   * Manually assign a delivery agent to an order
   */
  static async manualAssignAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { agentUserId } = req.body;

      // Verify agent user exists and is a DELIVERY_AGENT
      const agentCheck = await query(`SELECT id, name FROM users WHERE id = $1 AND role = 'DELIVERY_AGENT';`, [agentUserId]);
      if (agentCheck.rowCount === 0) {
        res.status(400).json({ success: false, error: 'Selected user is not a valid delivery agent.' });
        return;
      }

      // Update Order Assigned Agent
      const updateRes = await query(
        `UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING tracking_number, customer_id;`,
        [agentUserId, id]
      );

      if (updateRes.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }

      // Update Agent Profile status to BUSY
      await query(`UPDATE agent_profiles SET status = 'BUSY', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;`, [agentUserId]);

      // Log Immutable History
      await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: OrderStatus.ASSIGNED,
        changedByUserId: req.user!.userId,
        actorRole: UserRole.ADMIN,
        notes: `Agent ${agentCheck.rows[0].name} manually assigned by Admin.`,
      });

      res.status(200).json({
        success: true,
        message: `Agent ${agentCheck.rows[0].name} assigned to order successfully.`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/orders/:id/auto-assign
   * Trigger spatial auto-assignment algorithm on demand
   */
  static async triggerAutoAssign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const orderRes = await query<{ pickup_zone_id: string }>(`SELECT pickup_zone_id FROM orders WHERE id = $1;`, [id]);
      if (orderRes.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }

      const assigned = await AssignmentService.findNearestAvailableAgent(undefined, orderRes.rows[0].pickup_zone_id);

      if (!assigned) {
        res.status(400).json({ success: false, error: 'No available delivery agents found in system currently.' });
        return;
      }

      await query(`UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP WHERE id = $2;`, [
        assigned.agentUserId,
        id,
      ]);
      await query(`UPDATE agent_profiles SET status = 'BUSY' WHERE user_id = $1;`, [assigned.agentUserId]);

      res.status(200).json({
        success: true,
        message: `Auto-assigned agent ${assigned.agentName} to order successfully.`,
        data: assigned,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/orders/:id/override-status
   * Admin status override with FSM bypass and audit log
   */
  static async overrideStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const result = await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: status as OrderStatus,
        changedByUserId: req.user!.userId,
        actorRole: UserRole.ADMIN,
        notes: `[ADMIN OVERRIDE]: ${notes}`,
      });

      // Fetch customer email to notify
      const custRes = await query<{ email: string; phone: string; tracking_number: string }>(
        `SELECT u.email, u.phone, o.tracking_number FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = $1;`,
        [id]
      );

      if (custRes.rowCount! > 0) {
        NotificationService.notifyOrderStatusChange({
          customerEmail: custRes.rows[0].email,
          customerPhone: custRes.rows[0].phone,
          trackingNumber: custRes.rows[0].tracking_number,
          newStatus: status as OrderStatus,
          notes: `Admin Status Override: ${notes}`,
        });
      }

      res.status(200).json({
        success: true,
        message: `Order status overridden to ${status} successfully.`,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/orders/create-on-behalf
   * Admin creates an order on behalf of a customer
   */
  static async createOnBehalfOrder(req: Request, res: Response): Promise<void> {
    try {
      const {
        customerId,
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
      } = req.body;

      // 1. Resolve Zones
      const pickupZone = await ZoneService.resolveZone(undefined, pickupPincode);
      const dropZone = await ZoneService.resolveZone(undefined, dropPincode);

      // 2. Calculate Pricing via Rate Engine
      const quote = await RateService.calculateOrderCharge({
        dimensions: { lengthCm, widthCm, heightCm },
        actualWeightKg,
        orderType,
        paymentType,
        pickupZoneId: pickupZone.zoneId,
        dropZoneId: dropZone.zoneId,
      });

      const trackingNumber = `TRK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 3. Create Order
      const insertSql = `
        INSERT INTO orders (
          tracking_number, customer_id, pickup_address, drop_address,
          pickup_zone_id, drop_zone_id, length_cm, width_cm, height_cm,
          actual_weight_kg, volumetric_weight_kg, chargeable_weight_kg,
          order_type, payment_type, base_charge, weight_charge, cod_surcharge, total_charge, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CREATED')
        RETURNING id, tracking_number;
      `;

      const orderResult = await query<{ id: string; tracking_number: string }>(insertSql, [
        trackingNumber,
        customerId,
        pickupAddress,
        dropAddress,
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

      const newOrder = orderResult.rows[0];

      // 4. Log initial history
      await OrderLifecycleService.transitionStatus({
        orderId: newOrder.id,
        newStatus: OrderStatus.CREATED,
        changedByUserId: req.user!.userId,
        actorRole: UserRole.ADMIN,
        notes: 'Order created on behalf of customer by Admin.',
      });

      // 5. Attempt Auto-Assignment
      const assigned = await AssignmentService.findNearestAvailableAgent(undefined, pickupZone.zoneId);
      if (assigned) {
        await query(`UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED' WHERE id = $2;`, [
          assigned.agentUserId,
          newOrder.id,
        ]);
        await query(`UPDATE agent_profiles SET status = 'BUSY' WHERE user_id = $1;`, [assigned.agentUserId]);
      }

      res.status(201).json({
        success: true,
        message: 'Order created on behalf of customer successfully.',
        data: {
          orderId: newOrder.id,
          trackingNumber: newOrder.tracking_number,
          quote,
          assignedAgent: assigned || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
