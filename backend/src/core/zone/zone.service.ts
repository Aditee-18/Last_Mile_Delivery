import { query } from '../../config/database.js';
import { Coordinates } from '../../types/order.enums.js';

export interface ZoneDetectionResult {
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  detectedBy: 'LAT_LNG_BOUNDING_BOX' | 'AREA_PINCODE_MAPPING' | 'DEFAULT_FALLBACK';
}

export class ZoneService {
  /**
   * Hybrid Zone Detection Engine: Determines zone from Lat/Lng coordinates using bounding box
   */
  static async detectZoneFromCoordinates(coords: Coordinates): Promise<ZoneDetectionResult | null> {
    const sql = `
      SELECT id, name, code
      FROM zones
      WHERE $1 BETWEEN min_lat AND max_lat
        AND $2 BETWEEN min_lng AND max_lng
      LIMIT 1;
    `;

    const res = await query<{ id: string; name: string; code: string }>(sql, [
      coords.latitude,
      coords.longitude,
    ]);

    if (res.rowCount! > 0) {
      const zone = res.rows[0];
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneCode: zone.code,
        detectedBy: 'LAT_LNG_BOUNDING_BOX',
      };
    }

    return null;
  }

  /**
   * Detect Zone from Area / Pincode Mapping Table
   */
  static async detectZoneFromPincode(pincode: string): Promise<ZoneDetectionResult | null> {
    const sql = `
      SELECT z.id, z.name, z.code
      FROM areas a
      JOIN zones z ON a.zone_id = z.id
      WHERE a.pincode = $1
      LIMIT 1;
    `;

    const res = await query<{ id: string; name: string; code: string }>(sql, [pincode]);

    if (res.rowCount! > 0) {
      const zone = res.rows[0];
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneCode: zone.code,
        detectedBy: 'AREA_PINCODE_MAPPING',
      };
    }

    return null;
  }

  /**
   * Smart Zone Resolver: Tries coordinates first, falls back to pincode, then default zone
   */
  static async resolveZone(coords?: Coordinates, pincode?: string): Promise<ZoneDetectionResult> {
    if (coords && coords.latitude && coords.longitude) {
      const bboxZone = await this.detectZoneFromCoordinates(coords);
      if (bboxZone) return bboxZone;
    }

    if (pincode) {
      const pincodeZone = await this.detectZoneFromPincode(pincode);
      if (pincodeZone) return pincodeZone;
    }

    // Fallback to first active zone in database if neither match
    const fallbackRes = await query<{ id: string; name: string; code: string }>(
      `SELECT id, name, code FROM zones ORDER BY created_at ASC LIMIT 1;`
    );

    if (fallbackRes.rowCount === 0) {
      throw new Error('No delivery zones configured in system. Admin must add at least one zone.');
    }

    const fallbackZone = fallbackRes.rows[0];
    return {
      zoneId: fallbackZone.id,
      zoneName: fallbackZone.name,
      zoneCode: fallbackZone.code,
      detectedBy: 'DEFAULT_FALLBACK',
    };
  }
}
