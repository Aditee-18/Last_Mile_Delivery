import { Request, Response } from 'express';
import { query } from '../../config/database.js';

export class AdminRateController {
  /**
   * GET /api/admin/rate-cards
   */
  static async listRateCards(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(`
        SELECT id, order_type, is_intra_zone, base_fare, base_weight_kg, per_kg_rate, min_charge, updated_at
        FROM rate_cards
        ORDER BY order_type ASC, is_intra_zone DESC;
      `);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/rate-cards/:id
   */
  static async updateRateCard(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { baseFare, baseWeightKg, perKgRate, minCharge } = req.body;

      const sql = `
        UPDATE rate_cards
        SET base_fare = $1, base_weight_kg = $2, per_kg_rate = $3, min_charge = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, order_type, is_intra_zone, base_fare, base_weight_kg, per_kg_rate, min_charge, updated_at;
      `;

      const result = await query(sql, [baseFare, baseWeightKg, perKgRate, minCharge, id]);

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Rate card not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Rate card updated successfully.',
        data: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/admin/surcharges
   */
  static async listSurcharges(req: Request, res: Response): Promise<void> {
    try {
      const result = await query(`
        SELECT id, order_type, surcharge_type, surcharge_value, updated_at
        FROM surcharge_configs
        ORDER BY order_type ASC;
      `);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/admin/surcharges/:id
   */
  static async updateSurcharge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { surchargeType, surchargeValue } = req.body;

      const sql = `
        UPDATE surcharge_configs
        SET surcharge_type = $1, surcharge_value = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, order_type, surcharge_type, surcharge_value, updated_at;
      `;

      const result = await query(sql, [surchargeType, surchargeValue, id]);

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Surcharge config not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'COD surcharge configuration updated successfully.',
        data: result.rows[0],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
