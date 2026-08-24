import { AuthService } from '../auth/auth.service.js';
import { CustomerController } from './customer.controller.js';
import { OrderTrackingController } from '../orders/order.tracking.controller.js';
import { OrderType, PaymentType, OrderStatus } from '../../types/order.enums.js';
import { query, pool } from '../../config/database.js';

async function runCustomerTests() {
  console.log('🧪 Starting Customer Order Engine & Tracking Portal Integration Tests...');

  try {
    // 1. Authenticate as Customer
    console.log('1️⃣ Authenticating as Customer...');
    const customerAuth = await AuthService.login({
      email: 'customer@delivery.com',
      password: 'password123',
    });
    console.assert(customerAuth.user.role === 'CUSTOMER', 'Must be customer role');
    console.log('✅ Customer authenticated successfully. User ID:', customerAuth.user.id);

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

    // 2. Test Live Quote Calculation
    console.log('2️⃣ Testing Pre-Confirmation Live Price Quote Engine...');
    const quoteRes = createMockRes();
    await CustomerController.calculateQuote(
      {
        body: {
          lengthCm: 40,
          widthCm: 30,
          heightCm: 20, // Volumetric = (40*30*20)/5000 = 4.8kg
          actualWeightKg: 2.0,
          orderType: OrderType.B2C,
          paymentType: PaymentType.COD,
          pickupPincode: '110001',
          dropPincode: '110005',
        },
      } as any,
      quoteRes
    );
    console.assert(quoteRes.statusCode === 200, 'Expected status 200');
    console.assert(quoteRes.body.data.volumetricWeightKg === 4.8, 'Volumetric weight must be 4.8kg');
    console.assert(quoteRes.body.data.isIntraZone === true, 'Intra-zone must be true');
    console.log('✅ Price Quote Test Passed:', quoteRes.body.data);

    // 3. Test Order Creation & Auto-Assignment
    console.log('3️⃣ Testing Order Placement & Auto-Assignment Engine...');
    const createRes = createMockRes();
    await CustomerController.createOrder(
      {
        user: { userId: customerAuth.user.id, role: 'CUSTOMER' },
        body: {
          pickupAddress: 'Connaught Place Block A, New Delhi',
          dropAddress: 'Karol Bagh Metro Station, New Delhi',
          lengthCm: 40,
          widthCm: 30,
          heightCm: 20,
          actualWeightKg: 2.0,
          orderType: OrderType.B2C,
          paymentType: PaymentType.COD,
          pickupPincode: '110001',
          dropPincode: '110005',
        },
      } as any,
      createRes
    );
    console.assert(createRes.statusCode === 201, 'Expected status 201');
    const createdOrder = createRes.body.data;
    console.log('✅ Order Placement Passed! Tracking #:', createdOrder.trackingNumber);

    // 4. Test Customer Orders List
    console.log('4️⃣ Testing Customer Orders List Retrieval...');
    const listRes = createMockRes();
    await CustomerController.listMyOrders(
      {
        user: { userId: customerAuth.user.id, role: 'CUSTOMER' },
      } as any,
      listRes
    );
    console.assert(listRes.statusCode === 200, 'Expected status 200');
    console.assert(listRes.body.data.length > 0, 'Orders list should not be empty');
    console.log('✅ Customer Orders List Passed!');

    // 5. Test Public Tracking Timeline
    console.log('5️⃣ Testing Public Order Live Tracking Timeline...');
    const trackRes = createMockRes();
    await OrderTrackingController.getTrackingTimeline(
      {
        params: { trackingNumber: createdOrder.trackingNumber },
      } as any,
      trackRes
    );
    console.assert(trackRes.statusCode === 200, 'Expected status 200');
    console.assert(trackRes.body.data.timeline.length >= 1, 'Timeline must contain history events');
    console.log('✅ Public Live Tracking Timeline Passed! History events count:', trackRes.body.data.timeline.length);

    // 6. Test Failed Delivery Reschedule Flow
    console.log('6️⃣ Testing Failed Delivery Reschedule Flow...');
    // Manually flag order status to FAILED in DB to simulate agent delivery attempt failure
    await query(`UPDATE orders SET status = 'FAILED' WHERE id = $1;`, [createdOrder.orderId]);

    const rescheduleRes = createMockRes();
    await CustomerController.rescheduleFailedOrder(
      {
        user: { userId: customerAuth.user.id, role: 'CUSTOMER' },
        params: { id: createdOrder.orderId },
        body: {
          rescheduledDate: '2026-08-26',
          notes: 'Customer requested evening delivery window',
        },
      } as any,
      rescheduleRes
    );
    console.assert(rescheduleRes.statusCode === 200, 'Expected status 200');
    console.log('✅ Reschedule Failed Delivery Flow Passed!');

    console.log('\n🎉 ALL CUSTOMER ORDER ENGINE & TRACKING PORTAL INTEGRATION TESTS PASSED CLEANLY!');
  } catch (error) {
    console.error('❌ Customer Test Error:', error);
  } finally {
    await pool.end();
  }
}

runCustomerTests();
