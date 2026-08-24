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

  /**
   * Pending Orders Auto-Assigner: Automatically assigns unassigned CREATED orders when agents become available
   */
  static async assignPendingOrders(): Promise<number> {
    try {
      const pendingOrdersRes = await query<{
        id: string;
        tracking_number: string;
        pickup_zone_id: string;
        pickup_lat: number | null;
        pickup_lng: number | null;
      }>(
        `SELECT id, tracking_number, pickup_zone_id, pickup_lat, pickup_lng
         FROM orders
         WHERE status = 'CREATED' AND assigned_agent_id IS NULL
         ORDER BY created_at ASC;`
      );

      let assignedCount = 0;

      for (const order of pendingOrdersRes.rows) {
        const coords = order.pickup_lat && order.pickup_lng ? { latitude: Number(order.pickup_lat), longitude: Number(order.pickup_lng) } : undefined;
        const agent = await this.findNearestAvailableAgent(coords, order.pickup_zone_id);

        if (agent) {
          await query(
            `UPDATE orders SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
            [agent.agentUserId, order.id]
          );

          await query(
            `UPDATE agent_profiles SET status = 'BUSY', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1;`,
            [agent.agentUserId]
          );

          const { OrderLifecycleService } = await import('../lifecycle/fsm.js');
          const { UserRole, OrderStatus } = await import('../../types/order.enums.js');
          await OrderLifecycleService.transitionStatus({
            orderId: order.id,
            newStatus: OrderStatus.ASSIGNED,
            changedByUserId: agent.agentUserId,
            actorRole: UserRole.ADMIN,
            notes: `Auto-assigned to available agent: ${agent.agentName}`,
          });

          assignedCount++;
        }
      }

      return assignedCount;
    } catch (err) {
      console.warn('Pending order auto-assignment warning:', err);
      return 0;
    }
  }
}
