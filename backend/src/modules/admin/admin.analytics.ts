import { Request, Response } from 'express';
import { query } from '../../config/database';

export class AdminAnalyticsController {
  public static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const usersSummaryRes = await query(`
        SELECT 
          COUNT(CASE WHEN role = 'CUSTOMER' THEN 1 END)::int as total_customers,
          COUNT(CASE WHEN role = 'DELIVERY_AGENT' THEN 1 END)::int as total_agents
        FROM users;
      `);

      const agentStatusRes = await query(`
        SELECT status, COUNT(*)::int as count
        FROM agent_profiles
        GROUP BY status;
      `);

      const ordersSummaryRes = await query(`
        SELECT 
          COUNT(*)::int as total_orders,
          COUNT(CASE WHEN status = 'CREATED' THEN 1 END)::int as created_orders,
          COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END)::int as assigned_orders,
          COUNT(CASE WHEN status = 'PICKED_UP' THEN 1 END)::int as picked_up_orders,
          COUNT(CASE WHEN status = 'IN_TRANSIT' THEN 1 END)::int as in_transit_orders,
          COUNT(CASE WHEN status = 'OUT_FOR_DELIVERY' THEN 1 END)::int as out_for_delivery_orders,
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as completed_deliveries,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_deliveries,
          COUNT(CASE WHEN status = 'RESCHEDULED' THEN 1 END)::int as rescheduled_orders,
          COUNT(CASE WHEN status IN ('CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END)::int as active_deliveries,
          COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN total_charge ELSE 0 END), 0)::numeric as total_revenue,
          COALESCE(AVG(total_charge), 0)::numeric as avg_order_charge,
          COUNT(CASE WHEN payment_type = 'COD' THEN 1 END)::int as cod_orders,
          COUNT(CASE WHEN payment_type = 'PREPAID' THEN 1 END)::int as prepaid_orders
        FROM orders;
      `);

      const avgTimeRes = await query(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (d.created_at - p.created_at)) / 3600.0), 0)::numeric as avg_hours
        FROM order_status_history d
        JOIN order_status_history p ON d.order_id = p.order_id AND p.new_status = 'PICKED_UP'
        WHERE d.new_status = 'DELIVERED';
      `);

      const agentStats = { available: 0, busy: 0, offline: 0 };
      agentStatusRes.rows.forEach((row: { status: string; count: number }) => {
        if (row.status === 'AVAILABLE') agentStats.available = row.count;
        if (row.status === 'BUSY') agentStats.busy = row.count;
        if (row.status === 'OFFLINE') agentStats.offline = row.count;
      });

      const oRow = ordersSummaryRes.rows[0];
      const completed = oRow.completed_deliveries || 0;
      const failed = oRow.failed_deliveries || 0;
      const totalCompletedAttempts = completed + failed;

      let successRateStr = '0%';
      let failureRateStr = '0%';
      if (totalCompletedAttempts > 0) {
        successRateStr = `${Math.round((completed / totalCompletedAttempts) * 1000) / 10}%`;
        failureRateStr = `${Math.round((failed / totalCompletedAttempts) * 1000) / 10}%`;
      } else {
        successRateStr = 'N/A';
        failureRateStr = 'N/A';
      }

      const avgHours = Math.round(Number(avgTimeRes.rows[0].avg_hours) * 10) / 10;
      const avgDeliveryTimeStr = avgHours > 0 ? `${avgHours} hrs` : 'N/A';

      res.status(200).json({
        success: true,
        data: {
          customers: oRow.total_customers || usersSummaryRes.rows[0].total_customers,
          agents: {
            total: usersSummaryRes.rows[0].total_agents,
            statusBreakdown: agentStats,
          },
          deliveries: {
            totalOrders: oRow.total_orders,
            created: oRow.created_orders,
            assigned: oRow.assigned_orders,
            pickedUp: oRow.picked_up_orders,
            inTransit: oRow.in_transit_orders,
            outForDelivery: oRow.out_for_delivery_orders,
            completed: oRow.completed_deliveries,
            failed: oRow.failed_deliveries,
            rescheduled: oRow.rescheduled_orders,
            active: oRow.active_deliveries,
            totalRevenue: Number(oRow.total_revenue),
            avgOrderCharge: Math.round(Number(oRow.avg_order_charge) * 100) / 100,
            codOrders: oRow.cod_orders,
            prepaidOrders: oRow.prepaid_orders,
          },
          performance: {
            deliverySuccessRate: successRateStr,
            failureRate: failureRateStr,
            avgDeliveryTime: avgDeliveryTimeStr,
          },
          ordersAwaitingAttention: {
            unassignedOrders: oRow.created_orders,
            failedAwaitingReschedule: oRow.failed_deliveries,
            outForDelivery: oRow.out_for_delivery_orders,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate dashboard analytics.',
      });
    }
  }
}
