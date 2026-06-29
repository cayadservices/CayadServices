import { buildLandingPayloadWithRoute, type LandingFormInput } from "../utils/buildLandingPayload";
import { getPublicIP } from "./ip";

const BASE = import.meta.env.PUBLIC_API_URL;
const PUBLIC_API_KEY = import.meta.env.PUBLIC_API_KEY;

/** Response from the landing-leads endpoint */
export type LandingCreateResponse = {
  status: 'success' | 'error';
  id?: number;
  /** Unique code for the lead, used for public quote completion */
  signature_code?: string;
  /** URL to redirect user to CRM for quote completion */
  quote_url?: string;
  error?: string;
};

export async function sendLeadToLanding(input: LandingFormInput): Promise<LandingCreateResponse> {
  // Try to capture client public IP but don't block lead submission if it fails
  const ip = await getPublicIP().catch(() => null);
  const marketingAttribution =
    typeof window !== 'undefined' && typeof (window as any).getCayadMarketingAttribution === 'function'
      ? (window as any).getCayadMarketingAttribution({ channel: 'lead_form' })
      : undefined;
  const payload = {
    ...buildLandingPayloadWithRoute({
      ...input,
      ...(marketingAttribution ? { marketing_attribution: marketingAttribution } : {}),
    }),
    ...(ip ? { client_ip: ip } : {}),
    auto_convert: true,
    landing_source: "landing_form",
  };

  // Build the endpoint URL robustly. If BASE is provided use it as base,
  // otherwise fall back to a relative path so the client can call the
  // local `/api/leads/public-create/` route during development.
  let url: string;
  if (BASE) {
    // Using the URL constructor avoids accidental double slashes when BASE
    // ends with a trailing slash.
    url = new URL('/api/leads/public-create/', BASE).toString();
  } else {
    url = '/api/leads/public-create/';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(PUBLIC_API_KEY ? { 'X-API-KEY': PUBLIC_API_KEY } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}
