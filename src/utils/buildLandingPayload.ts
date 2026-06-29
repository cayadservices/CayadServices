import {
  parseCityStateZip,
  toISODate,
  toInopBoolean,
  toTransportLabel,
  type TransportLabel,
  normalizeContactPhone,
} from "./leadFormat";

export type ClientEstimate = {
  miles: number | null;
  per_mile: number | null;
  total: number | null;
  discounted_total?: number | null;
  normal_total?: number | null;
  transit: string | null;
  vehicle_class?: string;
  transport_type?: string; // "Open" | "Enclosed" label
  primary_vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    inop?: '0' | '1';
    vehicle_type?: string;
  };
};

export type LandingFormInput = {
  first_name: string;
  phone: string;
  email: string;

  origin_city: string;
  destination_city: string;

  origin_address?: string;
  origin_contactName?: string;
  origin_contactPhone?: string;
  origin_notes?: string;

  destination_address?: string;
  destination_contactName?: string;
  destination_contactPhone?: string;
  destination_notes?: string;

  ship_date?: string;
  transport_type?: string | number;
  /** Optional client-side estimate info to aid pricing follow-up */
  client_estimate?: ClientEstimate;
  /** Optional: full vehicles array (client-side representation) */
  Vehicles?: Array<{
    vehicle_type?: string;
    vehicle_year?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_inop?: '0' | '1';
  }>;
  /** Optional: primary vehicle details to include explicitly */
  primary_vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    inop?: '0' | '1';
    vehicle_type?: string;
  };
  /** Whether user selected premium/priority pricing (true) or economy/discounted (false) */
  is_premium?: boolean;
  marketing_attribution?: Record<string, string>;
};

export type LandingPayloadWithRoute = {
  first_name: string;
  phone: string;
  email: string;
  ship_date: string;
  transport_type: TransportLabel;
  /** Optional client public IP, if captured client-side */
  client_ip?: string;
  /** Optional client-side estimate info to aid pricing follow-up */
  client_estimate?: ClientEstimate;
  /** Optional: full vehicles array forwarded to backend */
  Vehicles?: Array<{
    vehicle_type?: string;
    vehicle_year?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_inop?: '0' | '1';
  }>;
  /** Optional: primary vehicle forwarded to backend */
  primary_vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    inop?: '0' | '1';
    vehicle_type?: string;
  };
  /** Whether user selected premium/priority pricing (true) or economy/discounted (false) */
  is_premium?: boolean;
  marketing_attribution?: Record<string, string>;
  route: {
    origin: {
      city: string;
      state: string;
      postalCode: string;
      address: string;
      contactName: string;
      contactPhone: string;
      notes: string;
      type: "private";
    };
    destination: {
      city: string;
      state: string;
      postalCode: string;
      address: string;
      contactName: string;
      contactPhone: string;
      notes: string;
      type: "private";
    };
  };
};

export function buildLandingPayloadWithRoute(input: LandingFormInput): LandingPayloadWithRoute {
  const o = parseCityStateZip(input.origin_city);
  const d = parseCityStateZip(input.destination_city);
  // Ensure numeric values in client_estimate are rounded to two decimals
  const round2 = (n: number | null | undefined): number | null => {
    if (n === null || typeof n === 'undefined') return null;
    // Keep integers intact but ensure two decimals via rounding
    return Math.round(n * 100) / 100;
  };
  const clientEstimate = input.client_estimate
    ? {
        ...input.client_estimate,
        miles: round2(input.client_estimate.miles),
        per_mile: round2(input.client_estimate.per_mile),
        total: round2(input.client_estimate.total),
      }
    : undefined;
  return {
    first_name: (input.first_name || "").trim(),
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim().toLowerCase(),
    ship_date: toISODate(input.ship_date),
    transport_type: toTransportLabel(input.transport_type),
    client_estimate: clientEstimate,
    Vehicles: input.Vehicles,
    // Accept primary vehicle either as top-level `primary_vehicle` or nested inside `client_estimate.primary_vehicle`
    primary_vehicle: input.primary_vehicle ?? (input.client_estimate as any)?.primary_vehicle,
    is_premium: input.is_premium,
    marketing_attribution: input.marketing_attribution,
    route: {
      origin: {
        city: o.city,
        state: o.state,
        postalCode: o.postalCode,
        address: (input.origin_address || "").trim(),
        contactName: (input.origin_contactName || "").trim(),
        contactPhone: normalizeContactPhone(input.origin_contactPhone),
        notes: (input.origin_notes || "").trim(),
        type: "private",
      },
      destination: {
        city: d.city,
        state: d.state,
        postalCode: d.postalCode,
        address: (input.destination_address || "").trim(),
        contactName: (input.destination_contactName || "").trim(),
        contactPhone: normalizeContactPhone(input.destination_contactPhone),
        notes: (input.destination_notes || "").trim(),
        type: "private",
      },
    },
  };
}
