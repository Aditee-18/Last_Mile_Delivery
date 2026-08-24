import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { UserRole } from '../types/order.enums';

export async function seedDatabase() {
  console.log('🌱 Starting Database Seeding Engine...');

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@delivery.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

    const existingAdmin = await query(
      'SELECT id FROM users WHERE role = $1 OR email = $2 LIMIT 1',
      [UserRole.ADMIN, adminEmail]
    );

    if (existingAdmin.rows.length === 0) {
      const adminHash = await bcrypt.hash(adminPassword, 10);
      await query(
        `INSERT INTO users (name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, $5)`,
        ['System Admin', adminEmail, adminHash, '+1111111111', UserRole.ADMIN]
      );
      console.log(`✅ Idempotent Seed: Primary Admin Created (${adminEmail})`);
    } else {
      console.log(`ℹ️ Idempotent Seed: Admin already exists (${adminEmail}). Skipping creation.`);
    }

    const northZoneRes = await query(
      `INSERT INTO zones (name, code, min_lat, max_lat, min_lng, max_lng)
       VALUES ('North Zone', 'ZONE_NORTH', 28.5000000, 28.9000000, 77.0000000, 77.4000000)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );

    const southZoneRes = await query(
      `INSERT INTO zones (name, code, min_lat, max_lat, min_lng, max_lng)
       VALUES ('South Zone', 'ZONE_SOUTH', 28.1000000, 28.4999999, 77.0000000, 77.4000000)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );

    const northZoneId = northZoneRes.rows[0].id;
    const southZoneId = southZoneRes.rows[0].id;

    await query(
      `INSERT INTO areas (name, pincode, zone_id)
       VALUES ('Connaught Place', '110001', $1), ('Karol Bagh', '110005', $1), ('Saket', '110017', $2)
       ON CONFLICT (pincode) DO NOTHING`,
      [northZoneId, southZoneId]
    );

    const customerRes = await query(
      'SELECT id FROM users WHERE email = $1',
      ['customer@delivery.com']
    );
    if (customerRes.rows.length === 0) {
      const custHash = await bcrypt.hash('password123', 10);
      await query(
        `INSERT INTO users (name, email, password_hash, phone, role)
         VALUES ('Alice Customer', 'customer@delivery.com', $1, '+1987654321', $2)`,
        [custHash, UserRole.CUSTOMER]
      );
      console.log('✅ Demo Customer Created (customer@delivery.com)');
    }

    const agentRes = await query(
      'SELECT id FROM users WHERE email = $1',
      ['agent.john@delivery.com']
    );
    if (agentRes.rows.length === 0) {
      const agentHash = await bcrypt.hash('password123', 10);
      const agentUser = await query(
        `INSERT INTO users (name, email, password_hash, phone, role)
         VALUES ('John Delivery Agent', 'agent.john@delivery.com', $1, '+1555444333', $2)
         RETURNING id`,
        [agentHash, UserRole.DELIVERY_AGENT]
      );
      await query(
        `INSERT INTO agent_profiles (user_id, status, current_lat, current_lng, assigned_zone_id)
         VALUES ($1, 'AVAILABLE', 28.7000000, 77.1500000, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [agentUser.rows[0].id, northZoneId]
      );
      console.log('✅ Demo Agent Created (agent.john@delivery.com)');
    }

    await query(
      `INSERT INTO rate_cards (order_type, is_intra_zone, base_fare, base_weight_kg, per_kg_rate, min_charge)
       VALUES 
       ('B2C', true, 40.00, 1.00, 15.00, 40.00),
       ('B2C', false, 80.00, 1.00, 25.00, 80.00),
       ('B2B', true, 100.00, 5.00, 10.00, 100.00),
       ('B2B', false, 200.00, 5.00, 20.00, 200.00)
       ON CONFLICT (order_type, is_intra_zone) DO NOTHING`
    );

    await query(
      `INSERT INTO surcharge_configs (order_type, surcharge_type, surcharge_value)
       VALUES 
       ('B2C', 'FLAT', 20.00),
       ('B2B', 'PERCENTAGE', 2.50)
       ON CONFLICT (order_type) DO NOTHING`
    );

    console.log('🎉 Database Seeding Completed Successfully!');
  } catch (err) {
    console.error('❌ Database Seeding Failed:', err);
    throw err;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
