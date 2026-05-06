import { apiUrl, estimatorApiUrl } from "./config";

export type TransportType = "open" | "enclosed";

export type GenericVehicleReq = {
  type: string; // e.g. "car", "suv", "pickup"
  inop?: boolean;
  count?: number; // default 1
};

export type SpecificVehicleReq = {
  year: number;
  make: string;
  model: string;
  // Optional: include a coarse type classification to help pricing if available
  type?: string; // e.g. "car", "suv", "pickup"
  inop?: boolean;
  count?: number; // default 1
};

export type TimeframeSeasonality = {
  shipping_timeframe: string;
  ship_date: string;
  total_modifier: number;
  timeframe_modifier: number;
  timeframe_reason: string;
  seasonality_modifier: number;
  seasonality_reason: string;
};

// Backwards-compat legacy fields are optional and should not be sent when using vehicles[]
export type PriceEstimateRequest = {
  origin_zip: string; // 5-digit US ZIP
  destination_zip: string; // 5-digit US ZIP
  transport_type: TransportType; // "open" | "enclosed"
  shipping_timeframe?: string;
  ship_date?: string; // YYYY-MM-DD
  vehicles?: Array<GenericVehicleReq | SpecificVehicleReq>;
  // legacy (single vehicle type):
  vehicle_type?: string;
  inop?: boolean;
  vehicles_count?: number; // default 1
};

export type PriceEstimateItem = {
  // Echo back request info for traceability
  type?: string;
  year?: number;
  make?: string;
  model?: string;
  inop?: boolean;
  count?: number;
  // Estimates
  low_estimate_total?: number;
  discounted_estimate_total?: number;
  normal_estimate_total?: number;
  per_mile?: number;
  // Confidence and sampling
  confidence?: "low" | "medium" | "high";
  confidence_pct?: number; // 0-100
  sample_size?: number;
};

export type PriceEstimateResponse = {
  estimate_available: boolean;
  items?: PriceEstimateItem[]; // when multiple vehicles requested
  // Aggregated totals for all items (optional, but recommended)
  discounted_estimate_total?: number;
  normal_estimate_total?: number;
  // Distances used for pricing and reference
  distance_used_for_pricing_miles?: number;
  reference_distance_miles?: number;
  estimated_transit_days?: number;
  // Overall confidence (optional)
  confidence?: "low" | "medium" | "high";
  confidence_pct?: number;
  sample_size?: number;
  // New fields
  timeframe_seasonality?: TimeframeSeasonality;
};

const PRICE_ESTIMATE_CACHE_TTL_MS = 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; value: PriceEstimateResponse }>();
const inFlightRequests = new Map<string, Promise<PriceEstimateResponse | null>>();

function buildRequestKey(payload: PriceEstimateRequest) {
  return JSON.stringify(payload);
}

export async function postPriceEstimate(payload: PriceEstimateRequest, signal?: AbortSignal): Promise<PriceEstimateResponse | null> {
  const cacheKey = buildRequestKey(payload);
  const canReuse = !signal;

  if (canReuse) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const existing = inFlightRequests.get(cacheKey);
    if (existing) {
      return existing;
    }
  }

  const canonical = estimatorApiUrl("/api/public/price-estimate/");
  const legacyCanonical = apiUrl("/api/public/price-estimate/");
  const alias = apiUrl("/leads/public/price-estimate/");
  const body = JSON.stringify(payload);
  const requestPromise = (async () => {
    try {
      let res = await fetch(canonical, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
      if (!res.ok && legacyCanonical !== canonical) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[priceEstimate] Estimator endpoint failed (${res.status}):`, errorText);
        res = await fetch(legacyCanonical, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
      }
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[priceEstimate] Primary endpoint failed (${res.status}):`, errorText);
        res = await fetch(alias, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
      }
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[priceEstimate] Fallback endpoint also failed (${res.status}):`, errorText);
        return null;
      }
      const data = (await res.json()) as PriceEstimateResponse;
      if (canReuse && data) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + PRICE_ESTIMATE_CACHE_TTL_MS,
          value: data,
        });
      }
      return data;
    } catch (err) {
      console.error('[priceEstimate] Exception:', err);
      return null;
    } finally {
      if (canReuse) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (canReuse) {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
}
