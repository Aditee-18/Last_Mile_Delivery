import { Request, Response } from 'express';
import { query } from '../../config/database';
import { AuthService } from '../auth/auth.service';
import { OrderLifecycleService } from '../../core/lifecycle/fsm';
import { AssignmentService } from '../../core/assignment/assignment.service';
import { RateService } from '../../core/rate-engine/rate.service';
import { ZoneService } from '../../core/zone/zone.service';
import { UserRole, OrderStatus } from '../../types/order.enums';

export class AdminController {
  public static async createAgent(req: Request, res: Response): Promise<void> {
    try {
      const agentUser = await AuthService.createAgentByAdmin(req.body);
      res.status(201).json({
        success: true,
        message: 'Delivery agent account provisioned successfully by Admin.',
        data: agentUser,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async listAgents(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
                ap.id as profile_id, ap.status as agent_status, ap.current_lat, ap.current_lng,
                z.name as assigned_zone_name, z.code as assigned_zone_code
         FROM users u
         JOIN agent_profiles ap ON ap.user_id = u.id
         LEFT JOIN zones z ON z.id = ap.assigned_zone_id
         WHERE u.role = $1
         ORDER BY u.created_at DESC`,
        [UserRole.DELIVERY_AGENT]
      );
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const { status, zoneId, agentId, search, limit = 50, offset = 0 } = req.query;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIdx = 1;

      if (status) {
        whereConditions.push(`o.status = $${paramIdx++}`);
        queryParams.push(status);
      }

      if (zoneId) {
        whereConditions.push(`(o.pickup_zone_id = $${paramIdx} OR o.drop_zone_id = $${paramIdx})`);
        queryParams.push(zoneId);
        paramIdx++;
      }

      if (agentId) {
        whereConditions.push(`o.assigned_agent_id = $${paramIdx++}`);
        queryParams.push(agentId);
      }

      if (search) {
        whereConditions.push(
          `(o.tracking_number ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`
        );
        queryParams.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) FROM orders o JOIN users u ON u.id = o.customer_id ${whereClause}`;
      const countRes = await query(countSql, queryParams);
      const totalCount = parseInt(countRes.rows[0].count, 10);

      const sql = `
        SELECT o.*, 
               u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
               pz.name as pickup_zone_name, dz.name as drop_zone_name,
               au.name as agent_name, au.phone as agent_phone
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        LEFT JOIN zones pz ON pz.id = o.pickup_zone_id
        LEFT JOIN zones dz ON dz.id = o.drop_zone_id
        LEFT JOIN users au ON au.id = o.assigned_agent_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `;

      queryParams.push(Number(limit), Number(offset));
      const ordersRes = await query(sql, queryParams);

      res.status(200).json({
        success: true,
        data: {
          orders: ordersRes.rows,
          pagination: {
            total: totalCount,
            limit: Number(limit),
            offset: Number(offset),
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async manualAssignAgent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!agentId) {
        res.status(400).json({ success: false, error: 'Agent ID is required.' });
        return;
      }

      const agentCheck = await query(
        `SELECT u.id, u.name, ap.status 
         FROM users u 
         JOIN agent_profiles ap ON ap.user_id = u.id 
         WHERE u.id = $1 AND u.role = 'DELIVERY_AGENT'`,
        [agentId]
      );

      if (agentCheck.rows.length === 0) {
        res.status(400).json({ success: false, error: 'Specified agent not found.' });
        return;
      }

      await query('BEGIN');
      try {
        await query(
          `UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED', updated_at = NOW() WHERE id = $2`,
          [agentId, id]
        );

        await query(`UPDATE agent_profiles SET status = 'BUSY', updated_at = NOW() WHERE user_id = $1`, [agentId]);

        await OrderLifecycleService.transitionStatus({
          orderId: id,
          newStatus: OrderStatus.ASSIGNED,
          changedByUserId: adminUserId,
          actorRole: UserRole.ADMIN,
          notes: `Admin manual agent assignment: ${agentCheck.rows[0].name}`,
        });

        await query('COMMIT');
        res.status(200).json({ success: true, message: `Agent ${agentCheck.rows[0].name} manually assigned.` });
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async triggerAutoAssign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adminUserId = (req as any).user.userId;

      const orderRes = await query('SELECT * FROM orders WHERE id = $1', [id]);
      if (orderRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }

      const order = orderRes.rows[0];
      const agentResult = await AssignmentService.findNearestAvailableAgent(
        order.pickup_lat ? { latitude: Number(order.pickup_lat), longitude: Number(order.pickup_lng) } : undefined,
        order.pickup_zone_id
      );

      if (!agentResult) {
        res.status(200).json({
          success: false,
          message: 'No available delivery agent found in proximity at this time.',
        });
        return;
      }

      await query('BEGIN');
      try {
        await query(
          `UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED', updated_at = NOW() WHERE id = $2`,
          [agentResult.agentUserId, order.id]
        );

        await query(`UPDATE agent_profiles SET status = 'BUSY', updated_at = NOW() WHERE user_id = $1`, [agentResult.agentUserId]);

        await OrderLifecycleService.transitionStatus({
          orderId: order.id,
          newStatus: OrderStatus.ASSIGNED,
          changedByUserId: adminUserId,
          actorRole: UserRole.ADMIN,
          notes: `Spatial auto-assignment: ${agentResult.agentName}`,
        });

        await query('COMMIT');
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

      res.status(200).json({
        success: true,
        message: 'Spatial auto-assignment executed successfully.',
        data: { assignedAgentId: agentResult.agentUserId, agentName: agentResult.agentName },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async overrideStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const adminUserId = (req as any).user.userId;

      if (!notes) {
        res.status(400).json({ success: false, error: 'Audit note is required for admin status override.' });
        return;
      }

      await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: status as OrderStatus,
        changedByUserId: adminUserId,
        actorRole: UserRole.ADMIN,
        notes: `Admin Override: ${notes}`,
      });

      res.status(200).json({
        success: true,
        message: `Order status overridden to ${status}.`,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async createOnBehalfOrder(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = (req as any).user.userId;
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

      const userCheck = await query('SELECT id FROM users WHERE id = $1 AND role = $2', [customerId, UserRole.CUSTOMER]);
      if (userCheck.rows.length === 0) {
        res.status(400).json({ success: false, error: 'Specified customer not found.' });
        return;
      }

      const pickupZone = await ZoneService.resolveZone(undefined, pickupPincode);
      const dropZone = await ZoneService.resolveZone(undefined, dropPincode);

      const quote = await RateService.calculateOrderCharge({
        dimensions: { lengthCm: Number(lengthCm), widthCm: Number(widthCm), heightCm: Number(heightCm) },
        actualWeightKg: Number(actualWeightKg),
        orderType,
        paymentType,
        pickupZoneId: pickupZone?.zoneId || '',
        dropZoneId: dropZone?.zoneId || '',
      });

      const trackingNumber = `TRK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await query('BEGIN');
      let newOrder: any;
      try {
        const orderRes = await query(
          `INSERT INTO orders (
            tracking_number, customer_id, pickup_address, drop_address,
            pickup_zone_id, drop_zone_id, actual_weight_kg, volumetric_weight_kg,
            chargeable_weight_kg, order_type, payment_type, base_charge,
            weight_charge, cod_surcharge, total_charge, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'CREATED')
          RETURNING *`,
          [
            trackingNumber,
            customerId,
            pickupAddress,
            dropAddress,
            pickupZone?.zoneId || null,
            dropZone?.zoneId || null,
            actualWeightKg,
            quote.volumetricWeightKg,
            quote.chargeableWeightKg,
            orderType,
            paymentType,
            quote.baseFare,
            quote.weightCharge,
            quote.codSurcharge,
            quote.totalCharge,
          ]
        );

        newOrder = orderRes.rows[0];

        await OrderLifecycleService.transitionStatus({
          orderId: newOrder.id,
          newStatus: OrderStatus.CREATED,
          changedByUserId: adminUserId,
          actorRole: UserRole.ADMIN,
          notes: 'Order created on behalf of customer by Admin.',
        });

        await query('COMMIT');
      } catch (err) {
        await query('ROLLBACK');
        throw err;
      }

      const agentResult = await AssignmentService.findNearestAvailableAgent(undefined, pickupZone?.zoneId);
      if (agentResult) {
        await query(
          `UPDATE orders SET assigned_agent_id = $1, status = 'ASSIGNED', updated_at = NOW() WHERE id = $2`,
          [agentResult.agentUserId, newOrder.id]
        );

        await query(`UPDATE agent_profiles SET status = 'BUSY', updated_at = NOW() WHERE user_id = $1`, [agentResult.agentUserId]);

        await OrderLifecycleService.transitionStatus({
          orderId: newOrder.id,
          newStatus: OrderStatus.ASSIGNED,
          changedByUserId: adminUserId,
          actorRole: UserRole.ADMIN,
          notes: `Auto-assignment: ${agentResult.agentName}`,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Order created on behalf of customer successfully.',
        data: {
          orderId: newOrder.id,
          trackingNumber,
          totalCharge: quote.totalCharge,
          assignedAgentId: agentResult?.agentUserId,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
