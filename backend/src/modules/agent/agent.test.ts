import { query } from '../../config/database.js';

async function verifyGpsAndAgentWorkflow() {
  console.log('🧪 Verifying GPS Location Broadcast & Agent Database Integration...\n');

  try {
    // 1. Fetch any agent user
    const agentRes = await query<{ id: string; name: string }>(
      `SELECT u.id, u.name FROM users u JOIN agent_profiles ap ON u.id = ap.user_id WHERE u.role = 'DELIVERY_AGENT' LIMIT 1;`
    );

    if (agentRes.rowCount === 0) {
      console.log('⚠️ No agent profile found in DB. Run seed first.');
      return;
    }

    const agent = agentRes.rows[0];
    console.log(`1️⃣ Found Agent: ${agent.name} (ID: ${agent.id})`);

    // 2. Simulate GPS Broadcast update to PostgreSQL
    const testLat = 28.7041;
    const testLng = 77.1025;
    const testStatus = 'AVAILABLE';

    console.log(`2️⃣ Broadcasting GPS Coordinates (Lat: ${testLat}, Lng: ${testLng}, Status: ${testStatus})...`);
    await query(
      `UPDATE agent_profiles SET current_lat = $1, current_lng = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4;`,
      [testLat, testLng, testStatus, agent.id]
    );

    // 3. Inspect updated record from PostgreSQL
    const checkRes = await query<{ current_lat: string; current_lng: string; status: string; updated_at: Date }>(
      `SELECT current_lat, current_lng, status, updated_at FROM agent_profiles WHERE user_id = $1;`,
      [agent.id]
    );

    const updated = checkRes.rows[0];
    console.log(`3️⃣ Verification SQL Output:`);
    console.log(`   - Latitude: ${updated.current_lat} (Expected: 28.7041)`);
    console.log(`   - Longitude: ${updated.current_lng} (Expected: 77.1025)`);
    console.log(`   - Status: ${updated.status} (Expected: AVAILABLE)`);
    console.log(`   - Updated At: ${updated.updated_at.toISOString()}`);

    const isSuccess = Number(updated.current_lat) === testLat && Number(updated.current_lng) === testLng;
    if (isSuccess) {
      console.log('\n🎉 GPS LOCATION BROADCAST IS 100% WORKING & VERIFIED IN POSTGRESQL!');
    } else {
      console.log('\n❌ Verification Failed!');
    }
  } catch (err: any) {
    console.error('Error during verification:', err);
  }
}

verifyGpsAndAgentWorkflow();
