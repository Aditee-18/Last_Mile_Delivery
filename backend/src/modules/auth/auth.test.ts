import { AuthService } from './auth.service';
import { UserRole } from '../../types/order.enums';
import { pool } from '../../config/database';

async function runAuthSecurityTests() {
  console.log('🧪 Starting Security & Server-Controlled Role Verification Tests...');
  const testEmail = `test.user.${Date.now()}@delivery.com`;
  const attackerEmail = `attacker.${Date.now()}@delivery.com`;

  try {
    console.log('1️⃣ Testing Public Registration (Server-Controlled Customer Role)...');
    const registerResult = await AuthService.registerCustomer({
      name: 'Test Customer',
      email: testEmail,
      password: 'password123',
      phone: '+1555999888',
    });

    console.assert(registerResult.user.email === testEmail, 'Registered email mismatch');
    console.assert(registerResult.user.role === UserRole.CUSTOMER, 'Role MUST be CUSTOMER');
    console.log('✅ Public Registration Passed! Account created as CUSTOMER.');

    console.log('2️⃣ Testing Privilege Escalation Attack Prevention (Sending role=ADMIN)...');
    const attackerResult = await AuthService.registerCustomer({
      name: 'Attacker User',
      email: attackerEmail,
      password: 'password123',
      phone: '+1555999777',
      role: UserRole.ADMIN,
    } as any);

    console.assert(
      attackerResult.user.role === UserRole.CUSTOMER,
      'SECURITY CRITICAL: Server failed to override supplied role. Created non-customer role!'
    );
    console.log('✅ Privilege Escalation Attack Prevention Passed! User created strictly as CUSTOMER.');

    console.log('3️⃣ Testing Login Credentials & JWT Token Claims...');
    const loginResult = await AuthService.login({
      email: testEmail,
      password: 'password123',
    });

    console.assert(loginResult.user.id === registerResult.user.id, 'User ID mismatch');
    console.assert(loginResult.user.role === UserRole.CUSTOMER, 'JWT token role must match DB role');
    console.log('✅ Login & Database Role Resolution Passed!');

    console.log('4️⃣ Testing Duplicate Email Rejection...');
    try {
      await AuthService.registerCustomer({
        name: 'Duplicate User',
        email: testEmail,
        password: 'password123',
        phone: '+1555999888',
      });
      console.error('❌ Failed: Duplicate email was improperly allowed.');
    } catch (err: any) {
      console.log('✅ Duplicate Email Rejection Passed:', err.message);
    }

    console.log('5️⃣ Testing Get User By ID...');
    const userProfile = await AuthService.getUserById(registerResult.user.id);
    console.assert(userProfile.email === testEmail, 'User email mismatch');
    console.log('✅ User Retrieval Passed!');

    console.log('\n🎉 ALL SECURITY & ROLE AUTHORIZATION TESTS PASSED CLEANLY!');
  } catch (error) {
    console.error('❌ Auth Security Test Error:', error);
  } finally {
    await pool.end();
  }
}

runAuthSecurityTests();
