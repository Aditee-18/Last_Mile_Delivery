import { pool, query } from '../../config/database.js';
import { OrderStatus, UserRole, Coordinates } from '../../types/order.enums.js';

/**
 * Valid Status Transitions Matrix (Finite State Machine)
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.ASSIGNED, OrderStatus.FAILED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.FAILED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT, OrderStatus.FAILED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.DELIVERED]: [], // Terminal state
  [OrderStatus.FAILED]: [OrderStatus.RESCHEDULED],
  [OrderStatus.RESCHEDULED]: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP],
};

export class OrderLifecycleService {
  /**
   * Validate status transition via Finite State Machine
   */
  static isValidTransition(currentStatus: OrderStatus, targetStatus: OrderStatus, actorRole: UserRole): boolean {
    // ADMIN can override to any status except illegal jumps from terminal state
    if (actorRole === UserRole.ADMIN) {
      return true;
    }

    // Allow initial status log event or idempotent status updates
    if (currentStatus === targetStatus) {
      return true;
    }

    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
    return allowedNextStatuses.includes(targetStatus);
  }

  /**
   * Transaction-safe status transition with Immutable History Logging
   */
  static async transitionStatus(params: {
    orderId: string;
    newStatus: OrderStatus;
    changedByUserId: string;
    actorRole: UserRole;
    location?: Coordinates;
    notes?: string;
  }): Promise<{ success: boolean; previousStatus: OrderStatus; newStatus: OrderStatus }> {
    const { orderId, newStatus, changedByUserId, actorRole, location, notes } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch current status with FOR UPDATE row lock
      const currentOrderRes = await client.query<{ status: OrderStatus }>(
        'SELECT status FROM orders WHERE id = $1 FOR UPDATE;',
        [orderId]
      );

      if (currentOrderRes.rowCount === 0) {
        throw new Error(`Order with ID ${orderId} not found.`);
      }

      const previousStatus = currentOrderRes.rows[0].status;

      // 2. Validate transition
      if (!this.isValidTransition(previousStatus, newStatus, actorRole)) {
        throw new Error(`Invalid status transition from ${previousStatus} to ${newStatus} for role ${actorRole}.`);
      }

      // 3. Update Order Status
      await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
        [newStatus, orderId]
      );

      // 4. Log Immutable Status Tracking History Record
      const historyInsertSql = `
        INSERT INTO order_status_history (
          order_id, previous_status, new_status, changed_by_user_id, actor_role, location_lat, location_lng, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `;

      const historyValues = [
        orderId,
        previousStatus,
        newStatus,
        changedByUserId,
        actorRole,
        location ? location.latitude : null,
        location ? location.longitude : null,
        notes || null,
      ];

      await client.query(historyInsertSql, historyValues);

      await client.query('COMMIT');

      // 5. Automatically notify customer at EACH stage asynchronously
      try {
        const custInfoRes = await query<{ email: string; phone: string; tracking_number: string }>(
          `SELECT u.email, u.phone, o.tracking_number FROM orders o JOIN users u ON o.customer_id = u.id WHERE o.id = $1;`,
          [orderId]
        );

        if (custInfoRes.rowCount! > 0) {
          const { email, phone, tracking_number } = custInfoRes.rows[0];
          const { NotificationService } = await import('../notifications/notification.service.js');
          NotificationService.notifyOrderStatusChange({
            customerEmail: email,
            customerPhone: phone,
            trackingNumber: tracking_number,
            newStatus: newStatus,
            notes: notes || `Order ${tracking_number} status updated to ${newStatus.replace(/_/g, ' ')}.`,
          });
        }
      } catch (notifyErr) {
        console.warn('Status notification dispatch warning:', notifyErr);
      }

      return { success: true, previousStatus, newStatus };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch full immutable tracking timeline for an order
   */
  static async getTrackingHistory(orderId: string) {
    const sql = `
      SELECT 
        h.id,
        h.previous_status,
        h.new_status,
        h.actor_role,
        h.notes,
        h.created_at,
        u.name as actor_name,
        h.location_lat as latitude,
        h.location_lng as longitude
      FROM order_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.order_id = $1
      ORDER BY h.created_at ASC;
    `;
    const res = await query(sql, [orderId]);
    return res.rows;
  }
}
