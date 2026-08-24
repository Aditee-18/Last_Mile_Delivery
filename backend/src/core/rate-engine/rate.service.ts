import { query } from '../../config/database.js';
import { RateCalculationInput, RateCalculationBreakdown } from '../../types/order.enums.js';
import { RateCalculator, RawRateCard, RawSurchargeConfig } from './rate.calculator.js';

export class RateService {
  /**
   * DB-Backed Rate Engine: Looks up dynamic Admin Rate Cards and Surcharge rules from PostgreSQL
   */
  static async calculateOrderCharge(input: RateCalculationInput): Promise<RateCalculationBreakdown> {
    const { dimensions, actualWeightKg, orderType, paymentType, pickupZoneId, dropZoneId } = input;

    // 1. Calculate Volumetric & Chargeable Weight
    const volumetricWeightKg = RateCalculator.calculateVolumetricWeight(dimensions);
    const chargeableWeightKg = RateCalculator.computeChargeableWeight(actualWeightKg, volumetricWeightKg);

    // 2. Check Intra vs Inter Zone
    const isIntraZone = pickupZoneId === dropZoneId;

    // 3. Query matching Rate Card from DB
    const rateCardResult = await query<RawRateCard>(
      `SELECT base_fare, base_weight_kg, per_kg_rate, min_charge
       FROM rate_cards
       WHERE order_type = $1 AND is_intra_zone = $2
       LIMIT 1;`,
      [orderType, isIntraZone]
    );

    if (rateCardResult.rowCount === 0) {
      throw new Error(`Rate card not configured for Order Type: ${orderType}, Intra-Zone: ${isIntraZone}`);
    }

    const rateCard = rateCardResult.rows[0];

    // 4. Query Surcharge Config if payment is COD
    let surchargeConfig: RawSurchargeConfig | undefined;
    if (paymentType === 'COD') {
      const surchargeResult = await query<RawSurchargeConfig>(
        `SELECT surcharge_type, surcharge_value
         FROM surcharge_configs
         WHERE order_type = $1
         LIMIT 1;`,
        [orderType]
      );
      if (surchargeResult.rowCount! > 0) {
        surchargeConfig = surchargeResult.rows[0];
      }
    }

    // 5. Compute Breakdown using calculation engine
    return RateCalculator.computeBreakdown({
      actualWeightKg,
      volumetricWeightKg,
      chargeableWeightKg,
      isIntraZone,
      rateCard,
      surchargeConfig,
      paymentType,
    });
  }
}
