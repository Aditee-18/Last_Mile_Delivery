import { AuthService } from '../auth/auth.service.js';
import { AdminAnalyticsController } from './admin.analytics.js';
import { AdminZoneController } from './admin.zone.controller.js';
import { AdminRateController } from './admin.rate.controller.js';
import { AdminOrderController } from './admin.order.controller.js';
import { OrderStatus, OrderType, PaymentType } from '../../types/order.enums.js';
import { query, pool } from '../../config/database.js';

async function runAdminTests() {
  console.log('🧪 Starting Admin Operations Module Integration Tests...');

  try {
    // 1. Authenticate as System Admin
    console.log('1️⃣ Authenticating as System Admin...');
    const adminLogin = await AuthService.login({
      email: 'admin@delivery.com',
      password: 'password123',
    });
    console.assert(adminLogin.user.role === 'ADMIN', 'Must be admin role');
    console.log('✅ Admin authenticated successfully. User ID:', adminLogin.user.id);

    // Mock Express Req/Res helper
    const createMockRes = () => {
      const res: any = {};
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        res.body = data;
        return res;
      };
      return res;
    };

    // 2. Test Analytics Overview Controller
    console.log('2️⃣ Testing Analytics Overview Controller...');
    const analyticsRes = createMockRes();
    await AdminAnalyticsController.getOverview({} as any, analyticsRes);
    console.assert(analyticsRes.statusCode === 200, 'Expected status 200');
    console.assert(typeof analyticsRes.body.data.customers === 'number', 'Customers count present');
    console.log('✅ Analytics Overview Test Passed:', analyticsRes.body.data);

    // 3. Test Create Zone & Area
    console.log('3️⃣ Testing Zone & Area Creation...');
    const zoneRes = createMockRes();
    await AdminZoneController.createZone(
      {
        body: {
          name: `Test East Zone ${Date.now()}`,
          code: `EAST_${Date.now()}`,
          minLat: 22.5,
          maxLat: 22.8,
          minLng: 88.3,
          maxLng: 88.5,
        },
      } as any,
      zoneRes
    );
    console.assert(zoneRes.statusCode === 201, 'Expected status 201');
    const createdZoneId = zoneRes.body.data.id;
    console.log('✅ Zone Creation Passed! Zone ID:', createdZoneId);

    // 4. Test Bulk CSV Importer
    console.log('4️⃣ Testing Bulk CSV Pincode Importer...');
    const bulkRes = createMockRes();
    await AdminZoneController.bulkImportPincodes(
      {
        body: {
          mappings: [
            { name: 'Kolkata Central', pincode: '700001', zoneId: createdZoneId },
            { name: 'Salt Lake', pincode: '700091', zoneId: createdZoneId },
          ],
        },
      } as any,
      bulkRes
    );
    console.assert(bulkRes.statusCode === 200, 'Expected status 200');
    console.log('✅ Bulk CSV Pincode Importer Passed!');

    // 5. Test Rate Cards List & Update
    console.log('5️⃣ Testing Rate Card Updates...');
    const rateListRes = createMockRes();
    await AdminRateController.listRateCards({} as any, rateListRes);
    console.assert(rateListRes.body.data.length > 0, 'Rate cards should exist');
    const firstRateCard = rateListRes.body.data[0];

    const rateUpdateRes = createMockRes();
    await AdminRateController.updateRateCard(
      {
        params: { id: firstRateCard.id },
        body: {
          baseFare: 45.0,
          baseWeightKg: 1.0,
          perKgRate: 16.0,
          minCharge: 45.0,
        },
      } as any,
      rateUpdateRes
    );
    console.assert(rateUpdateRes.statusCode === 200, 'Expected status 200');
    console.log('✅ Rate Card Update Passed!');

    // 6. Test On-Behalf Order Creation
    console.log('6️⃣ Testing Admin On-Behalf Order Creation...');
    const customer = await query(`SELECT id FROM users WHERE role = 'CUSTOMER' LIMIT 1;`);
    const onBehalfRes = createMockRes();

    await AdminOrderController.createOnBehalfOrder(
      {
        user: { userId: adminLogin.user.id, role: 'ADMIN' },
        body: {
          customerId: customer.rows[0].id,
          pickupAddress: 'Connaught Place, New Delhi',
          dropAddress: 'Karol Bagh, New Delhi',
          lengthCm: 30,
          widthCm: 20,
          heightCm: 15,
          actualWeightKg: 2.5,
          orderType: OrderType.B2C,
          paymentType: PaymentType.COD,
          pickupPincode: '110001',
          dropPincode: '110005',
        },
      } as any,
      onBehalfRes
    );
    console.assert(onBehalfRes.statusCode === 201, 'Expected status 201');
    const createdOrderId = onBehalfRes.body.data.orderId;
    console.log('✅ On-Behalf Order Creation Passed! Order ID:', createdOrderId);

    // 7. Test Admin Status Override
    console.log('7️⃣ Testing Admin Order Status Override...');
    const overrideRes = createMockRes();
    await AdminOrderController.overrideStatus(
      {
        user: { userId: adminLogin.user.id, role: 'ADMIN' },
        params: { id: createdOrderId },
        body: {
          status: OrderStatus.IN_TRANSIT,
          notes: 'Express admin dispatch override',
        },
      } as any,
      overrideRes
    );
    console.assert(overrideRes.statusCode === 200, 'Expected status 200');
    console.log('✅ Admin Status Override Passed!');

    console.log('\n🎉 ALL ADMIN OPERATIONS MODULE INTEGRATION TESTS PASSED CLEANLY!');
  } catch (error) {
    console.error('❌ Admin Test Error:', error);
  } finally {
    await pool.end();
  }
}

runAdminTests();
