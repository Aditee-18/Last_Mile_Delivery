import { Request, Response } from 'express';
import { query } from '../../config/database.js';
import { OrderLifecycleService } from '../../core/lifecycle/fsm.js';
import { NotificationService } from '../../core/notifications/notification.service.js';
import { OrderStatus, UserRole, AgentStatus } from '../../types/order.enums.js';

export class AgentController {
  /**
   * GET /api/agent/profile
   * Fetch agent status, assigned zone, and delivery statistics
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;

      const profileSql = `
        SELECT 
          ap.id,
          ap.status,
          ap.current_lat,
          ap.current_lng,
          z.name as assigned_zone_name,
          z.code as assigned_zone_code,
          ap.updated_at
        FROM agent_profiles ap
        LEFT JOIN zones z ON ap.assigned_zone_id = z.id
        WHERE ap.user_id = $1;
      `;

      const profileRes = await query(profileSql, [agentUserId]);
      if (profileRes.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Agent profile not found.' });
        return;
      }

      // Delivery stats query
      const statsSql = `
        SELECT 
          COUNT(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END)::int as active_tasks,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as completed_tasks,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_tasks
        FROM orders
        WHERE assigned_agent_id = $1;
      `;

      const statsRes = await query(statsSql, [agentUserId]);

      res.status(200).json({
        success: true,
        data: {
          profile: profileRes.rows[0],
          stats: statsRes.rows[0],
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/agent/location
   * Broadcast live GPS location and update agent availability status
   */
  static async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;
      const { latitude, longitude, status } = req.body;

      const sql = `
        UPDATE agent_profiles
        SET 
          current_lat = $1,
          current_lng = $2,
          status = COALESCE($3, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4
        RETURNING status, current_lat, current_lng, updated_at;
      `;

      const result = await query(sql, [latitude, longitude, status || null, agentUserId]);

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Agent profile not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Location and status updated successfully.',
        data: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/agent/orders
   * View orders assigned to this agent
   */
  static async listAssignedOrders(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;
      const { filter = 'active' } = req.query;

      let statusFilter = `AND o.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY')`;
      if (filter === 'completed') {
        statusFilter = `AND o.status = 'DELIVERED'`;
      } else if (filter === 'failed') {
        statusFilter = `AND o.status = 'FAILED'`;
      } else if (filter === 'all') {
        statusFilter = ``;
      }

      const sql = `
        SELECT 
          o.id,
          o.tracking_number,
          u.name as customer_name,
          u.phone as customer_phone,
          u.email as customer_email,
          o.pickup_address,
          o.drop_address,
          o.pickup_lat,
          o.pickup_lng,
          o.drop_lat,
          o.drop_lng,
          pz.name as pickup_zone,
          dz.name as drop_zone,
          o.actual_weight_kg,
          o.volumetric_weight_kg,
          o.chargeable_weight_kg,
          o.order_type,
          o.payment_type,
          o.total_charge,
          o.status,
          o.rescheduled_date,
          o.created_at,
          o.updated_at
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        LEFT JOIN zones pz ON o.pickup_zone_id = pz.id
        LEFT JOIN zones dz ON o.drop_zone_id = dz.id
        WHERE o.assigned_agent_id = $1 ${statusFilter}
        ORDER BY o.updated_at DESC;
      `;

      const result = await query(sql, [agentUserId]);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/agent/orders/:id/status
   * Advance order status (PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED)
   */
  static async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;
      const { id } = req.params;
      const { status, latitude, longitude, notes } = req.body;

      // Verify order belongs to agent
      const orderCheck = await query<{ status: OrderStatus; tracking_number: string; customer_id: string }>(
        `SELECT status, tracking_number, customer_id FROM orders WHERE id = $1 AND assigned_agent_id = $2;`,
        [id, agentUserId]
      );

      if (orderCheck.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Order not found or not assigned to you.' });
        return;
      }

      const location = latitude && longitude ? { latitude, longitude } : undefined;

      // 1. Transition status via FSM
      const transitionResult = await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: status as OrderStatus,
        changedByUserId: agentUserId,
        actorRole: UserRole.DELIVERY_AGENT,
        location,
        notes: notes || `Status updated to ${status} by delivery agent.`,
      });

      // 2. If status is DELIVERED, set Agent profile status back to AVAILABLE
      if (status === OrderStatus.DELIVERED) {
        await query(`UPDATE agent_profiles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;`, [
          agentUserId,
        ]);
      }

      // 3. Emit Email & SMS Notification to Customer
      const custRes = await query<{ email: string; phone: string }>(`SELECT email, phone FROM users WHERE id = $1;`, [
        orderCheck.rows[0].customer_id,
      ]);

      if (custRes.rowCount! > 0) {
        NotificationService.notifyOrderStatusChange({
          customerEmail: custRes.rows[0].email,
          customerPhone: custRes.rows[0].phone,
          trackingNumber: orderCheck.rows[0].tracking_number,
          newStatus: status as OrderStatus,
          notes: notes || `Package is now ${status.replace(/_/g, ' ')}.`,
        });
      }

      res.status(200).json({
        success: true,
        message: `Order status updated to ${status} successfully.`,
        data: transitionResult,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/agent/orders/:id/fail
   * Flag delivery failure & trigger customer reschedule notification
   */
  static async failOrder(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;
      const { id } = req.params;
      const { reasonNotes, latitude, longitude } = req.body;

      // Verify order is assigned to agent
      const orderCheck = await query<{ status: OrderStatus; tracking_number: string; customer_id: string }>(
        `SELECT status, tracking_number, customer_id FROM orders WHERE id = $1 AND assigned_agent_id = $2;`,
        [id, agentUserId]
      );

      if (orderCheck.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Order not found or not assigned to you.' });
        return;
      }

      const location = latitude && longitude ? { latitude, longitude } : undefined;

      // 1. Transition status to FAILED via FSM
      const transitionResult = await OrderLifecycleService.transitionStatus({
        orderId: id,
        newStatus: OrderStatus.FAILED,
        changedByUserId: agentUserId,
        actorRole: UserRole.DELIVERY_AGENT,
        location,
        notes: `Delivery Attempt Failed: ${reasonNotes}`,
      });

      // 2. Reset Agent Profile Status back to AVAILABLE
      await query(`UPDATE agent_profiles SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;`, [
        agentUserId,
      ]);

      // 3. Emit High-Priority Email & SMS Notification with Reschedule Link
      const custRes = await query<{ email: string; phone: string }>(`SELECT email, phone FROM users WHERE id = $1;`, [
        orderCheck.rows[0].customer_id,
      ]);

      if (custRes.rowCount! > 0) {
        NotificationService.notifyOrderStatusChange({
          customerEmail: custRes.rows[0].email,
          customerPhone: custRes.rows[0].phone,
          trackingNumber: orderCheck.rows[0].tracking_number,
          newStatus: OrderStatus.FAILED,
          notes: `Delivery attempt failed: ${reasonNotes}. Please log into your dashboard to reschedule.`,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Delivery flagged as FAILED. Customer notified to reschedule.',
        data: transitionResult,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/agent/analytics
   * Returns authenticated delivery agent's operational metrics
   */
  static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const agentUserId = req.user!.userId;

      const profileRes = await query<{ status: string }>(
        `SELECT status FROM agent_profiles WHERE user_id = $1;`,
        [agentUserId]
      );

      const statsSql = `
        SELECT 
          COUNT(CASE WHEN status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END)::int as assigned_active,
          COUNT(CASE WHEN status IN ('PICKED_UP', 'IN_TRANSIT') THEN 1 END)::int as in_transit,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as completed_total,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_total
        FROM orders
        WHERE assigned_agent_id = $1;
      `;
      const statsRes = await query(statsSql, [agentUserId]);

      const deliveredTodayRes = await query(`
        SELECT COUNT(DISTINCT order_id)::int as delivered_today
        FROM order_status_history
        WHERE changed_by_user_id = $1
          AND actor_role = 'DELIVERY_AGENT'
          AND new_status = 'DELIVERED'
          AND created_at >= CURRENT_DATE;
      `, [agentUserId]);

      res.status(200).json({
        success: true,
        data: {
          assignedActiveTasks: statsRes.rows[0].assigned_active || 0,
          inTransit: statsRes.rows[0].in_transit || 0,
          deliveredToday: deliveredTodayRes.rows[0].delivered_today || 0,
          completedTasksTotal: statsRes.rows[0].completed_total || 0,
          failedTasksTotal: statsRes.rows[0].failed_total || 0,
          dutyStatus: profileRes.rows[0]?.status || 'OFFLINE',
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
