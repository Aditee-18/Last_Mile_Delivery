import { query } from '../../config/database.js';
import { Coordinates } from '../../types/order.enums.js';

export interface AssignedAgentResult {
  agentUserId: string;
  agentName: string;
  phone: string;
  distanceMeters: number;
}

export class AssignmentService {
  /**
   * Spatial Auto-Assignment Engine using Haversine Great Circle Distance:
   * Finds the nearest AVAILABLE agent using SQL trigonometry from pickup location coordinates or zone.
   */
  static async findNearestAvailableAgent(
    pickupLocation?: Coordinates,
    pickupZoneId?: string,
    maxRadiusMeters: number = 20000 // Default 20km radius
  ): Promise<AssignedAgentResult | null> {
    // 1. Haversine Spatial Search if pickup coordinates exist
    if (pickupLocation && pickupLocation.latitude && pickupLocation.longitude) {
      const spatialSql = `
        SELECT 
          u.id as agent_user_id,
          u.name as agent_name,
          u.phone,
          (
            6371000 * acos(
              cos(radians($1)) * cos(radians(ap.current_lat)) *
              cos(radians(ap.current_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(ap.current_lat))
            )
          ) as distance_meters
        FROM agent_profiles ap
        JOIN users u ON ap.user_id = u.id
        WHERE ap.status = 'AVAILABLE'
          AND ap.current_lat IS NOT NULL
          AND ap.current_lng IS NOT NULL
        ORDER BY distance_meters ASC
        LIMIT 1;
      `;

      const spatialRes = await query<{
        agent_user_id: string;
        agent_name: string;
        phone: string;
        distance_meters: number;
      }>(spatialSql, [pickupLocation.latitude, pickupLocation.longitude]);

      if (spatialRes.rowCount! > 0) {
        const row = spatialRes.rows[0];
        if (Number(row.distance_meters) <= maxRadiusMeters) {
          return {
            agentUserId: row.agent_user_id,
            agentName: row.agent_name,
            phone: row.phone,
            distanceMeters: Math.round(row.distance_meters),
          };
        }
      }
    }

    // 2. Zone-Based Fallback Search if spatial distance search yields no agents within radius
    if (pickupZoneId) {
      const zoneSql = `
        SELECT 
          u.id as agent_user_id,
          u.name as agent_name,
          u.phone,
          0 as distance_meters
        FROM agent_profiles ap
        JOIN users u ON ap.user_id = u.id
        WHERE ap.status = 'AVAILABLE'
          AND ap.assigned_zone_id = $1
        ORDER BY ap.updated_at ASC
        LIMIT 1;
      `;

      const zoneRes = await query<{
        agent_user_id: string;
        agent_name: string;
        phone: string;
        distance_meters: number;
      }>(zoneSql, [pickupZoneId]);

      if (zoneRes.rowCount! > 0) {
        const row = zoneRes.rows[0];
        return {
          agentUserId: row.agent_user_id,
          agentName: row.agent_name,
          phone: row.phone,
          distanceMeters: 0,
        };
      }
    }

    // 3. System-Wide Fallback: Any available agent
    const anySql = `
      SELECT 
        u.id as agent_user_id,
        u.name as agent_name,
        u.phone,
        0 as distance_meters
      FROM agent_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.status = 'AVAILABLE'
      ORDER BY ap.updated_at ASC
      LIMIT 1;
    `;

    const anyRes = await query<{
      agent_user_id: string;
      agent_name: string;
      phone: string;
      distance_meters: number;
    }>(anySql);

    if (anyRes.rowCount! > 0) {
      const row = anyRes.rows[0];
      return {
        agentUserId: row.agent_user_id,
        agentName: row.agent_name,
        phone: row.phone,
        distanceMeters: 0,
      };
    }

    return null;
  }
}
