import { Request, Response } from 'express';
import { query } from '../../config/database.js';

export class PublicAnalyticsController {
  public static async getPublicMetrics(req: Request, res: Response): Promise<void> {
    try {
      const ordersRes = await query(`
        SELECT 
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as completed_deliveries,
          COUNT(CASE WHEN status IN ('CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') THEN 1 END)::int as active_shipments,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_deliveries
        FROM orders;
      `);

      const customersRes = await query(`SELECT COUNT(*)::int as registered_customers FROM users WHERE role = 'CUSTOMER';`);

      const completed = ordersRes.rows[0].completed_deliveries || 0;
      const active = ordersRes.rows[0].active_shipments || 0;
      const failed = ordersRes.rows[0].failed_deliveries || 0;
      const registeredCustomers = customersRes.rows[0].registered_customers || 0;

      const totalFinished = completed + failed;
      let successRateStr = '0%';
      if (totalFinished > 0) {
        const rate = Math.round((completed / totalFinished) * 1000) / 10;
        successRateStr = `${rate}%`;
      }

      res.status(200).json({
        success: true,
        data: {
          completedDeliveries: completed,
          activeShipments: active,
          registeredCustomers: registeredCustomers,
          deliverySuccessRate: successRateStr,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch public analytics.' });
    }
  }
}
