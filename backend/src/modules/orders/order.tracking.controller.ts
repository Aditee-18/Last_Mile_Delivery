import { Request, Response } from 'express';
import { query } from '../../config/database.js';
import { OrderLifecycleService } from '../../core/lifecycle/fsm.js';

export class OrderTrackingController {
  /**
   * GET /api/orders/track/:trackingNumber
   * Public Endpoint: Fetches live order status and full immutable tracking timeline
   */
  static async getTrackingTimeline(req: Request, res: Response): Promise<void> {
    try {
      const { trackingNumber } = req.params;

      // 1. Fetch Order Details
      const orderSql = `
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
          agent.name as agent_name,
          agent.phone as agent_phone,
          o.rescheduled_date,
          o.created_at,
          o.updated_at
        FROM orders o
        LEFT JOIN zones pz ON o.pickup_zone_id = pz.id
        LEFT JOIN zones dz ON o.drop_zone_id = dz.id
        LEFT JOIN users agent ON o.assigned_agent_id = agent.id
        WHERE o.tracking_number = $1;
      `;

      const orderRes = await query(orderSql, [trackingNumber.trim()]);
      if (orderRes.rowCount === 0) {
        res.status(404).json({
          success: false,
          error: `No order found with tracking number "${trackingNumber}".`,
        });
        return;
      }

      const order = orderRes.rows[0];

      // 2. Fetch Immutable Tracking Timeline from FSM Ledger Service
      const timeline = await OrderLifecycleService.getTrackingHistory(order.id);

      res.status(200).json({
        success: true,
        data: {
          order,
          timeline,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
