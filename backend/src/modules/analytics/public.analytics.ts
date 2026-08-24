import { Request, Response } from 'express';
import { query } from '../../config/database';

export class PublicAnalyticsController {
  public static async getPublicMetrics(req: Request, res: Response): Promise<void> {
    try {
      const ordersRes = await query(`
        SELECT 
          COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::int as completed_deliveries,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_deliveries
        FROM orders;
      `);

      const zonesRes = await query(`SELECT COUNT(*)::int as total_zones FROM zones;`);
      const areasRes = await query(`SELECT COUNT(*)::int as total_areas FROM areas;`);
      const customersRes = await query(`SELECT COUNT(*)::int as total_customers FROM users WHERE role = 'CUSTOMER';`);

      const completed = ordersRes.rows[0].completed_deliveries || 0;
      const failed = ordersRes.rows[0].failed_deliveries || 0;
      const totalAttempts = completed + failed;

      let successRateStr = '0%';
      if (totalAttempts > 0) {
        const rate = Math.round((completed / totalAttempts) * 1000) / 10;
        successRateStr = `${rate}%`;
      } else {
        successRateStr = 'N/A';
      }

      res.status(200).json({
        success: true,
        data: {
          ordersDelivered: completed,
          deliverySuccessRate: successRateStr,
          serviceableZones: zonesRes.rows[0].total_zones || 0,
          serviceableAreas: areasRes.rows[0].total_areas || 0,
          customersServed: customersRes.rows[0].total_customers || 0,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch public analytics.' });
    }
  }
}
