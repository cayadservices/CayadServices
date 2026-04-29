import { apiUrl } from "./config";

export type AquaRouteInsightsLocation = {
  zip?: string;
  city?: string;
  state?: string;
};

export type AquaRouteInsightsRequest = {
  origin: AquaRouteInsightsLocation;
  destination: AquaRouteInsightsLocation;
  ship_date?: string | null;
};

export type AquaRouteInsightsResponse = {
  routeEffort?: {
    factor?: number;
    adjustmentPct?: number;
    adjustments?: string[];
  } | null;
  origin?: {
    fuel?: {
      regularPrice?: number | null;
      dieselPrice?: number | null;
    } | null;
  } | null;
  destination?: {
    fuel?: {
      regularPrice?: number | null;
      dieselPrice?: number | null;
    } | null;
  } | null;
} | null;

const ROUTE_INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; value: AquaRouteInsightsResponse }>();
const inFlightRequests = new Map<string, Promise<AquaRouteInsightsResponse>>();

function buildRequestKey(payload: AquaRouteInsightsRequest) {
  return JSON.stringify(payload);
}

export async function postAquaRouteInsights(
  payload: AquaRouteInsightsRequest,
  signal?: AbortSignal,
): Promise<AquaRouteInsightsResponse> {
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

  const requestPromise = (async () => {
    try {
      const endpoints = [
        apiUrl("/api/public/aqua-route-insights/"),
        "/api/aqua-route-insights",
      ];

      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal,
        });

        if (res.ok) {
          const data = (await res.json()) as AquaRouteInsightsResponse;
          if (canReuse) {
            responseCache.set(cacheKey, {
              expiresAt: Date.now() + ROUTE_INSIGHTS_CACHE_TTL_MS,
              value: data,
            });
          }
          return data;
        }
      }

      return null;
    } catch (error) {
      console.warn("[aquaRouteInsights] Request failed", error);
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
