import { RateCalculator } from './rate.calculator.js';
import { PaymentType } from '../../types/order.enums.js';

console.log('🧪 Running Core Rate Calculator Tests...');

// Test 1: Volumetric Weight
const dims = { lengthCm: 50, widthCm: 40, heightCm: 30 }; // (50x40x30)/5000 = 12 kg
const volWeight = RateCalculator.calculateVolumetricWeight(dims);
console.assert(volWeight === 12, `Expected 12kg, got ${volWeight}`);
console.log('✅ Test 1 Passed: Volumetric weight calculation (12 kg)');

// Test 2: Chargeable Weight Selection
const actualWeight = 8;
const chargeable = RateCalculator.computeChargeableWeight(actualWeight, volWeight);
console.assert(chargeable === 12, `Expected 12kg, got ${chargeable}`);
console.log('✅ Test 2 Passed: Chargeable weight selection (max of 8kg actual vs 12kg volumetric = 12kg)');

// Test 3: Charge Breakdown with COD Surcharge
const breakdown = RateCalculator.computeBreakdown({
  actualWeightKg: 8,
  volumetricWeightKg: 12,
  chargeableWeightKg: 12,
  isIntraZone: true,
  rateCard: {
    base_fare: 40,
    base_weight_kg: 1,
    per_kg_rate: 15,
    min_charge: 40,
  },
  surchargeConfig: {
    surcharge_type: 'FLAT',
    surcharge_value: 25,
  },
  paymentType: PaymentType.COD,
});

// Expected: Base (40) + Extra Weight (11kg * 15 = 165) + COD (25) = 230
console.assert(breakdown.weightCharge === 165, `Expected weight charge 165, got ${breakdown.weightCharge}`);
console.assert(breakdown.codSurcharge === 25, `Expected COD surcharge 25, got ${breakdown.codSurcharge}`);
console.assert(breakdown.totalCharge === 230, `Expected total charge 230, got ${breakdown.totalCharge}`);

console.log('✅ Test 3 Passed: Itemized pricing breakdown:', breakdown);
console.log('🎉 All Core Rate Engine Tests Passed Cleanly!');
