import { Dimensions, PaymentType, RateCalculationBreakdown } from '../../types/order.enums.js';

export interface RawRateCard {
  base_fare: string | number;
  base_weight_kg: string | number;
  per_kg_rate: string | number;
  min_charge: string | number;
}

export interface RawSurchargeConfig {
  surcharge_type: 'FLAT' | 'PERCENTAGE';
  surcharge_value: string | number;
}

/**
 * Pure Mathematical Rate Calculation Engine
 */
export class RateCalculator {
  /**
   * Calculate Volumetric Weight in Kg
   * Formula: (Length x Width x Height) / 5000
   */
  static calculateVolumetricWeight(dimensions: Dimensions): number {
    const { lengthCm, widthCm, heightCm } = dimensions;
    if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
      throw new Error('Dimensions (L x B x H) must be positive non-zero values.');
    }
    const volumetric = (lengthCm * widthCm * heightCm) / 5000;
    return Math.round(volumetric * 100) / 100;
  }

  /**
   * Compute Chargeable Weight as MAX(Actual Weight, Volumetric Weight)
   */
  static computeChargeableWeight(actualWeightKg: number, volumetricWeightKg: number): number {
    if (actualWeightKg <= 0) {
      throw new Error('Actual weight must be greater than zero.');
    }
    return Math.round(Math.max(actualWeightKg, volumetricWeightKg) * 100) / 100;
  }

  /**
   * Calculate itemized freight charge and total billing breakdown
   */
  static computeBreakdown(params: {
    actualWeightKg: number;
    volumetricWeightKg: number;
    chargeableWeightKg: number;
    isIntraZone: boolean;
    rateCard: RawRateCard;
    surchargeConfig?: RawSurchargeConfig;
    paymentType: PaymentType;
  }): RateCalculationBreakdown {
    const {
      actualWeightKg,
      volumetricWeightKg,
      chargeableWeightKg,
      isIntraZone,
      rateCard,
      surchargeConfig,
      paymentType,
    } = params;

    const baseFare = Number(rateCard.base_fare);
    const baseWeightKg = Number(rateCard.base_weight_kg);
    const perKgRate = Number(rateCard.per_kg_rate);
    const minCharge = Number(rateCard.min_charge);

    // Calculate extra weight beyond base weight
    const extraWeightKg = Math.max(0, chargeableWeightKg - baseWeightKg);
    const weightCharge = Math.round(extraWeightKg * perKgRate * 100) / 100;

    let baseFreightSum = baseFare + weightCharge;
    if (baseFreightSum < minCharge) {
      baseFreightSum = minCharge;
    }

    // Calculate COD Surcharge if COD payment selected
    let codSurcharge = 0;
    if (paymentType === PaymentType.COD && surchargeConfig) {
      const sVal = Number(surchargeConfig.surcharge_value);
      if (surchargeConfig.surcharge_type === 'FLAT') {
        codSurcharge = sVal;
      } else if (surchargeConfig.surcharge_type === 'PERCENTAGE') {
        codSurcharge = Math.round((baseFreightSum * (sVal / 100)) * 100) / 100;
      }
    }

    const totalCharge = Math.round((baseFreightSum + codSurcharge) * 100) / 100;

    return {
      actualWeightKg,
      volumetricWeightKg,
      chargeableWeightKg,
      isIntraZone,
      baseFare,
      baseWeightKg,
      perKgRate,
      weightCharge,
      codSurcharge,
      totalCharge,
    };
  }
}
