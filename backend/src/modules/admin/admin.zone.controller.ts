import { Request, Response } from 'express';
import { query, pool } from '../../config/database.js';

export class AdminZoneController {
  /**
   * GET /api/admin/zones
   * List all zones with mapped area counts and active agents
   */
  static async listZones(req: Request, res: Response): Promise<void> {
    try {
      const sql = `
        SELECT 
          z.id,
          z.name,
          z.code,
          z.min_lat,
          z.max_lat,
          z.min_lng,
          z.max_lng,
          z.created_at,
          COUNT(DISTINCT a.id)::int as total_areas,
          COUNT(DISTINCT ap.id)::int as active_agents
        FROM zones z
        LEFT JOIN areas a ON a.zone_id = z.id
        LEFT JOIN agent_profiles ap ON ap.assigned_zone_id = z.id
        GROUP BY z.id
        ORDER BY z.created_at ASC;
      `;
      const result = await query(sql);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/zones
   * Create a new delivery zone with optional lat/lng bounding box
   */
  static async createZone(req: Request, res: Response): Promise<void> {
    try {
      const { name, code, minLat, maxLat, minLng, maxLng } = req.body;

      const sql = `
        INSERT INTO zones (name, code, min_lat, max_lat, min_lng, max_lng)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, code, min_lat, max_lat, min_lng, max_lng, created_at;
      `;

      const result = await query(sql, [
        name,
        code.toUpperCase(),
        minLat || null,
        maxLat || null,
        minLng || null,
        maxLng || null,
      ]);

      res.status(201).json({
        success: true,
        message: `Zone "${name}" created successfully.`,
        data: result.rows[0],
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ success: false, error: `Zone with name or code already exists.` });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/areas
   * Map a single area & pincode to a zone
   */
  static async createArea(req: Request, res: Response): Promise<void> {
    try {
      const { name, pincode, zoneId } = req.body;

      const sql = `
        INSERT INTO areas (name, pincode, zone_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, pincode, zone_id, created_at;
      `;

      const result = await query(sql, [name, pincode, zoneId]);
      res.status(201).json({
        success: true,
        message: `Area "${name}" (${pincode}) mapped to zone successfully.`,
        data: result.rows[0],
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ success: false, error: `Area with pincode "${req.body.pincode}" is already mapped.` });
        return;
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/areas/bulk-csv
   * Bulk import pincode mappings via transaction
   */
  static async bulkImportPincodes(req: Request, res: Response): Promise<void> {
    const { mappings } = req.body; // Array of { name, pincode, zoneId }
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      let importedCount = 0;

      for (const item of mappings) {
        await client.query(
          `
          INSERT INTO areas (name, pincode, zone_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (pincode) DO UPDATE SET name = EXCLUDED.name, zone_id = EXCLUDED.zone_id;
          `,
          [item.name, item.pincode, item.zoneId]
        );
        importedCount++;
      }

      await client.query('COMMIT');
      res.status(200).json({
        success: true,
        message: `Successfully imported/updated ${importedCount} pincode mappings.`,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }

  /**
   * DELETE /api/admin/zones/:id
   */
  static async deleteZone(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await query(`DELETE FROM zones WHERE id = $1 RETURNING name;`, [id]);

      if (result.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Zone not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Zone "${result.rows[0].name}" deleted successfully.`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
