import type { PriceEstimateItem, PriceEstimateResponse } from "./priceEstimate";

type NumericLike = number | null | undefined;
type SummaryLike = Partial<PriceEstimateResponse> & Record<string, unknown>;
type ItemLike = Partial<PriceEstimateItem> & Record<string, unknown>;

export type AquaDisplayPricingOptions = {
  routeEffortFactor?: NumericLike;
  applyRouteEffortToPremium?: boolean;
  applyRouteEffortToStandard?: boolean;
  minimumStandardTotal?: NumericLike;
  minimumPremiumTotal?: NumericLike;
};

export type AquaDisplayPricingResult = {
  routeEffortFactor: number;
  discountedTotal: number | null;
  normalTotal: number | null;
  premiumTotal: number | null;
  standardTotal: number | null;
  adjustedDiscountedTotal: number | null;
  adjustedNormalTotal: number | null;
  adjustedPremiumTotal: number | null;
  adjustedStandardTotal: number | null;
  minimumStandardTotal: number | null;
  minimumPremiumTotal: number | null;
  standardFloorDelta: number;
  premiumFloorDelta: number;
  displayPremiumTotal: number | null;
  displayStandardTotal: number | null;
};

export type AquaRouteFuelLike = {
  origin?: { fuel?: { regularPrice?: NumericLike; dieselPrice?: NumericLike } | null } | null;
  destination?: { fuel?: { regularPrice?: NumericLike; dieselPrice?: NumericLike } | null } | null;
} | null;

export const FUEL_ESTIMATE_MPG = 6.5;
export const FUEL_PRICE_GUARD_BUFFER = 50;

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const normalizeMultiplier = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const enforceMinimumTotal = (value: NumericLike, minimum: NumericLike) => {
  const numeric = toFiniteNumber(value);
  const floor = toFiniteNumber(minimum);
  if (floor == null) return numeric;
  if (numeric == null) return round2(floor);
  return round2(Math.max(numeric, floor));
};

const applyMultiplier = (value: NumericLike, multiplier: NumericLike) => {
  const numeric = toFiniteNumber(value);
  return numeric == null ? null : round2(numeric * normalizeMultiplier(multiplier));
};

const getItems = (summary: SummaryLike): ItemLike[] => (
  Array.isArray(summary?.items) ? (summary.items as ItemLike[]) : []
);

export function getAquaItemStandardTotal(item: ItemLike): number | null {
  return toFiniteNumber(
    item?.discounted_estimate_total ??
    item?.low_estimate_total ??
    item?.normal_estimate_total
  );
}

export function computeAquaDisplayPricing(
  summary: SummaryLike = {},
  options: AquaDisplayPricingOptions = {},
): AquaDisplayPricingResult {
  const routeEffortFactor = normalizeMultiplier(
    options?.routeEffortFactor ??
    summary?.route_effort_factor ??
    1,
  );
  const items = getItems(summary);

  const directDiscounted = toFiniteNumber(
    summary?.discounted_estimate_total ??
    summary?.discounted_total ??
    summary?.low_estimate_total ??
    summary?.economy_total,
  );

  const discountedFromItems = items.reduce((acc, item) => {
    return acc + (getAquaItemStandardTotal(item) ?? 0);
  }, 0);

  const discountedTotal = directDiscounted ??
    (discountedFromItems > 0 ? round2(discountedFromItems) : null);

  const directNormal = toFiniteNumber(
    summary?.normal_estimate_total ??
    summary?.normal_total ??
    summary?.premium_total,
  );

  const normalFromItems = items.reduce((acc, item) => {
    const normalItem = toFiniteNumber(item?.normal_estimate_total);
    if (normalItem != null) return acc + normalItem;

    const discountedItem = getAquaItemStandardTotal(item);
    return acc + (discountedItem != null ? round2(discountedItem * 1.15) : 0);
  }, 0);

  let normalTotal = directNormal;
  if (normalTotal == null && normalFromItems > 0) {
    normalTotal = round2(normalFromItems);
  }
  if (normalTotal == null && discountedTotal != null) {
    normalTotal = round2(discountedTotal * 1.15);
  }

  const premiumTotal = normalTotal ?? discountedTotal;
  const standardTotal = discountedTotal ?? normalTotal;
  const adjustedDiscountedTotal = applyMultiplier(discountedTotal, routeEffortFactor);
  const adjustedNormalTotal = applyMultiplier(normalTotal, routeEffortFactor);
  const adjustedPremiumTotal = applyMultiplier(premiumTotal, routeEffortFactor);
  const adjustedStandardTotal = applyMultiplier(standardTotal, routeEffortFactor);
  const applyRouteEffortToPremium = Boolean(options?.applyRouteEffortToPremium);
  const applyRouteEffortToStandard = Boolean(options?.applyRouteEffortToStandard);
  const minimumStandardTotal = toFiniteNumber(
    options?.minimumStandardTotal ??
    summary?.minimum_standard_total,
  );
  const minimumPremiumTotal = toFiniteNumber(
    options?.minimumPremiumTotal ??
    summary?.minimum_premium_total ??
    minimumStandardTotal,
  );

  const standardSourceTotal = applyRouteEffortToStandard
    ? adjustedStandardTotal
    : standardTotal;
  const premiumSourceTotal = applyRouteEffortToPremium
    ? adjustedPremiumTotal
    : premiumTotal;

  const displayStandardTotal = enforceMinimumTotal(
    standardSourceTotal,
    minimumStandardTotal,
  );
  const displayPremiumTotal = enforceMinimumTotal(
    premiumSourceTotal,
    minimumPremiumTotal,
  );

  const standardFloorDelta = (
    displayStandardTotal != null &&
    standardSourceTotal != null &&
    displayStandardTotal > standardSourceTotal
  )
    ? round2(displayStandardTotal - standardSourceTotal)
    : 0;
  const premiumFloorDelta = (
    displayPremiumTotal != null &&
    premiumSourceTotal != null &&
    displayPremiumTotal > premiumSourceTotal
  )
    ? round2(displayPremiumTotal - premiumSourceTotal)
    : 0;

  return {
    routeEffortFactor,
    discountedTotal,
    normalTotal,
    premiumTotal,
    standardTotal,
    adjustedDiscountedTotal,
    adjustedNormalTotal,
    adjustedPremiumTotal,
    adjustedStandardTotal,
    minimumStandardTotal,
    minimumPremiumTotal,
    standardFloorDelta,
    premiumFloorDelta,
    displayPremiumTotal,
    displayStandardTotal,
  };
}

export function computeFuelGuardFloor(
  distanceMiles: NumericLike,
  routeInsights: AquaRouteFuelLike,
): number | null {
  const distance = toFiniteNumber(distanceMiles);
  const originFuelPrice = toFiniteNumber(
    routeInsights?.origin?.fuel?.dieselPrice ?? routeInsights?.origin?.fuel?.regularPrice,
  );
  const destinationFuelPrice = toFiniteNumber(
    routeInsights?.destination?.fuel?.dieselPrice ?? routeInsights?.destination?.fuel?.regularPrice,
  );

  const routeFuelPrice = originFuelPrice != null && destinationFuelPrice != null
    ? (originFuelPrice + destinationFuelPrice) / 2
    : (originFuelPrice ?? destinationFuelPrice ?? null);

  const estimatedFuelGallons = distance != null && distance > 0
    ? distance / FUEL_ESTIMATE_MPG
    : null;
  const estimatedFuelCost = routeFuelPrice != null && estimatedFuelGallons != null
    ? routeFuelPrice * estimatedFuelGallons
    : null;

  return estimatedFuelCost != null
    ? Math.ceil(estimatedFuelCost + FUEL_PRICE_GUARD_BUFFER)
    : null;
}
