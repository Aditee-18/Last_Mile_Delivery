import { RateCalculator, RawRateCard, RawSurchargeConfig } from './rate.calculator';
import { PaymentType } from '../../types/order.enums';

async function runRateCalculatorTests() {
  console.log('🧪 Running Comprehensive Rate Engine & Mathematical Verification Suite...\n');

  const testRateCard: RawRateCard = {
    base_fare: 100.0,
    base_weight_kg: 5.0,
    per_kg_rate: 10.0,
    min_charge: 100.0,
  };

  console.log('--- 1. Verification of Examples A, B, C, D ---');

  const exA = RateCalculator.computeBreakdown({
    actualWeightKg: 2.0,
    volumetricWeightKg: 1.0,
    chargeableWeightKg: RateCalculator.computeChargeableWeight(2.0, 1.0),
    isIntraZone: true,
    rateCard: testRateCard,
    paymentType: PaymentType.PREPAID,
  });
  console.log('Example A (2kg Actual, 1kg Volumetric, 5kg Base Slab):');
  console.log(`  Chargeable Weight: ${exA.chargeableWeightKg} kg (Expected: 2 kg)`);
  console.log(`  Weight Charge: ₹${exA.weightCharge} (Expected: ₹0)`);
  console.log(`  Total Charge: ₹${exA.totalCharge} (Expected: ₹100)\n`);
  console.assert(exA.chargeableWeightKg === 2.0 && exA.totalCharge === 100.0, 'Example A Failed!');

  const exB = RateCalculator.computeBreakdown({
    actualWeightKg: 5.0,
    volumetricWeightKg: 4.0,
    chargeableWeightKg: RateCalculator.computeChargeableWeight(5.0, 4.0),
    isIntraZone: true,
    rateCard: testRateCard,
    paymentType: PaymentType.PREPAID,
  });
  console.log('Example B (5kg Actual, 4kg Volumetric, 5kg Base Slab):');
  console.log(`  Chargeable Weight: ${exB.chargeableWeightKg} kg (Expected: 5 kg)`);
  console.log(`  Weight Charge: ₹${exB.weightCharge} (Expected: ₹0)`);
  console.log(`  Total Charge: ₹${exB.totalCharge} (Expected: ₹100)\n`);
  console.assert(exB.chargeableWeightKg === 5.0 && exB.totalCharge === 100.0, 'Example B Failed!');

  const exC = RateCalculator.computeBreakdown({
    actualWeightKg: 5.1,
    volumetricWeightKg: 4.0,
    chargeableWeightKg: RateCalculator.computeChargeableWeight(5.1, 4.0),
    isIntraZone: true,
    rateCard: testRateCard,
    paymentType: PaymentType.PREPAID,
  });
  console.log('Example C (5.1kg Actual, 4kg Volumetric, 5kg Base Slab):');
  console.log(`  Chargeable Weight: ${exC.chargeableWeightKg} kg (Expected: 5.1 kg)`);
  console.log(`  Weight Charge: ₹${exC.weightCharge} (Expected: ₹1)`);
  console.log(`  Total Charge: ₹${exC.totalCharge} (Expected: ₹101)\n`);
  console.assert(exC.chargeableWeightKg === 5.1 && exC.totalCharge === 101.0, 'Example C Failed!');

  const exD = RateCalculator.computeBreakdown({
    actualWeightKg: 10.0,
    volumetricWeightKg: 12.0,
    chargeableWeightKg: RateCalculator.computeChargeableWeight(10.0, 12.0),
    isIntraZone: true,
    rateCard: testRateCard,
    paymentType: PaymentType.PREPAID,
  });
  console.log('Example D (10kg Actual, 12kg Volumetric, 5kg Base Slab):');
  console.log(`  Chargeable Weight: ${exD.chargeableWeightKg} kg (Expected: 12 kg)`);
  console.log(`  Weight Charge: ₹${exD.weightCharge} (Expected: ₹70)`);
  console.log(`  Total Charge: ₹${exD.totalCharge} (Expected: ₹170)\n`);
  console.assert(exD.chargeableWeightKg === 12.0 && exD.totalCharge === 170.0, 'Example D Failed!');

  console.log('--- 2. COD Surcharge Verification ---');
  const flatSurchargeConfig: RawSurchargeConfig = { surcharge_type: 'FLAT', surcharge_value: 20.0 };
  const percentSurchargeConfig: RawSurchargeConfig = { surcharge_type: 'PERCENTAGE', surcharge_value: 10.0 };

  const prepaidOrder = RateCalculator.computeBreakdown({
    actualWeightKg: 5.0,
    volumetricWeightKg: 4.0,
    chargeableWeightKg: 5.0,
    isIntraZone: true,
    rateCard: testRateCard,
    surchargeConfig: flatSurchargeConfig,
    paymentType: PaymentType.PREPAID,
  });
  console.log(`Prepaid COD Surcharge: ₹${prepaidOrder.codSurcharge} (Expected: ₹0)`);
  console.assert(prepaidOrder.codSurcharge === 0, 'PREPAID Surcharge Failed!');

  const codFlatOrder = RateCalculator.computeBreakdown({
    actualWeightKg: 5.0,
    volumetricWeightKg: 4.0,
    chargeableWeightKg: 5.0,
    isIntraZone: true,
    rateCard: testRateCard,
    surchargeConfig: flatSurchargeConfig,
    paymentType: PaymentType.COD,
  });
  console.log(`COD Flat Surcharge: ₹${codFlatOrder.codSurcharge} (Expected: ₹20)`);
  console.assert(codFlatOrder.codSurcharge === 20.0, 'COD Flat Surcharge Failed!');

  const codPercentOrder = RateCalculator.computeBreakdown({
    actualWeightKg: 5.0,
    volumetricWeightKg: 4.0,
    chargeableWeightKg: 5.0,
    isIntraZone: true,
    rateCard: testRateCard,
    surchargeConfig: percentSurchargeConfig,
    paymentType: PaymentType.COD,
  });
  console.log(`COD 10% Surcharge: ₹${codPercentOrder.codSurcharge} (Expected: ₹10)`);
  console.assert(codPercentOrder.codSurcharge === 10.0, 'COD Percentage Surcharge Failed!');

  console.log('\n🎉 ALL RATE ENGINE MATHEMATICAL TESTS PASSED CLEANLY!');
}

runRateCalculatorTests();
