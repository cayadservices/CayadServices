import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import Select from 'react-select';
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import ZipcodeAutocompleteRHF from "../inputs/ZipcodeAutocompleteRHF";
import { distanceForLocations, estimateTransitDays, formatMiles } from "../../services/distance";
import { parseCityStateZip } from "../../utils/leadFormat";
import { apiUrl } from "../../services/config";
import { postPriceEstimate, type PriceEstimateRequest, type PriceEstimateResponse, type TransportType } from "../../services/priceEstimate";
import { computeAquaDisplayPricing, computeFuelGuardFloor } from "../../services/aquaPricing";
import { postAquaRouteInsights } from "../../services/aquaRouteInsights";
// New unified vehicle selectors using /api/public/vehicle-options/
import VehicleYearSelect from "../VehicleYearSelect";
import VehicleMakeSelect from "../VehicleMakeSelect";
import VehicleModelSelect from "../VehicleModelSelect";
import VehicleTypeAsyncSelect from "../VehicleTypeAsyncSelect";
import AutoSuggestInput from "../inputs/AutoSuggestInput";
import CustomInputOnlyText from "../inputs/CustomInputOnlyText";
import CustomInputPhone from "../inputs/CustomInputPhone";
import CustomInput from "../inputs/CustomInput";
import DateInput from "../inputs/CustomInputDate";
import { FaRegPaperPlane, FaPlus, FaTrash, FaSpinner, FaUserShield, FaShieldAlt, FaCheck, FaShoppingCart, FaTimes, FaCar } from "react-icons/fa";
import { format, differenceInCalendarDays } from "date-fns";
import { sendLeadToLanding } from "../../services/lead";
import { saveEmail, saveLead, saveNumberLead, saveSignatureCode, saveQuoteUrl, saveSelectedPlan } from "../../services/localStorage";
import { showNotification } from "../../utils/notificaction";
import { isValidPhoneNumber } from "libphonenumber-js/max";
import Swal from "sweetalert2";
import RatePlanSelector from "./RatePlanSelector";
import InlineReviews from "../InlineReviews";

// Utility to format vehicle types from snake_case to readable labels
// e.g., 'truck_sleeper' -> 'Truck Sleeper', 'suv' -> 'SUV'
const formatVehicleType = (type: string | undefined | null): string => {
  if (!type) return 'Vehicle';
  // Handle common abbreviations
  const upperCaseWords = ['suv', 'atv', 'rv', 'utv'];
  return type
    .split('_')
    .map(word => upperCaseWords.includes(word.toLowerCase())
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(' ');
};

type TransportTypeVal = "1" | "2"; // 1 Open, 2 Enclosed
const USE_PRICE_ESTIMATE_API = false;

type Step1Values = {
  origin_city: string;
  destination_city: string;
  origin_city__isValid: boolean;
  destination_city__isValid: boolean;
  ship_date: string;
  shipping_timeframe: string;
};

const SHIPPING_TIMEFRAMES = [
  { value: "asap", label: "ASAP (Earliest Pickup)" },
  { value: "2_weeks", label: "Within 2 Weeks" },
  { value: "30_days", label: "Within 30 Days" },
  { value: "30_plus", label: "More than 30 Days" },
];

const step1Schema: yup.ObjectSchema<Step1Values> = yup
  .object({
    origin_city: yup
      .string()
      .required("Please provide a valid city or zip code.")
      .test("origin-selected", "Please select a suggestion from the list.", function () {
        return this.parent?.origin_city__isValid === true;
      }),
    destination_city: yup
      .string()
      .required("Please provide a valid city or zip code.")
      .test(
        "destination-selected",
        "Please select a suggestion from the list.",
        function () {
          return this.parent?.destination_city__isValid === true;
        }
      ),
    origin_city__isValid: yup.boolean().default(false),
    destination_city__isValid: yup.boolean().default(false),
  })
  .required()
  .shape({
    ship_date: yup.string().required("Date is required"),
    shipping_timeframe: yup.string().required("Please select a timeframe"),
  })
  .test('different-origin-destination', 'Origin and destination cannot be the same', function (val) {
    if (!val) return true;
    const o = String((val as any).origin_city || '').trim().toLowerCase();
    const d = String((val as any).destination_city || '').trim().toLowerCase();
    if (!o || !d) return true;
    if (o === d) {
      return this.createError({ path: 'destination_city', message: 'Origin and destination cannot be the same' });
    }
    return true;
  });

type Step2Values = {
  vehicle_type: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_inop?: '0' | '1';
};

const step2GenericSchema = yup.object({
  vehicle_type: yup.string().required("Vehicle type is required"),
  vehicle_year: yup.string().optional(),
  vehicle_make: yup.string().optional(),
  vehicle_model: yup.string().optional(),
  vehicle_inop: yup.mixed<'0' | '1'>().oneOf(['0', '1']).optional(),
});

const step2SpecificSchema = yup.object({
  vehicle_type: yup.string().optional(),
  vehicle_year: yup.string().required("Year is required").matches(/^(19|20)\d{2}$/, 'Year must be YYYY').test('year-range', 'Year out of range', function (val) {
    if (!val) return true; const y = Number(val); const max = new Date().getFullYear() + 1; const min = 1970; return y >= min && y <= max;
  }),
  vehicle_make: yup.string().required("Make is required").max(40),
  vehicle_model: yup.string().required("Model is required").max(60),
  vehicle_inop: yup.mixed<'0' | '1'>().oneOf(['0', '1']).optional(),
});

type ContactValues = {
  first_name: string;
  phone?: string; // optional, require at least one of phone/email via schema
  email?: string; // optional, require at least one of phone/email via schema
  website?: string; // honeypot
};

type VehicleRow = {
  vehicle_type: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_inop: '0' | '1';
};

type ParsedRouteLocation = ReturnType<typeof parseCityStateZip>;

const roundCurrency = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
};

async function resolveLandingDisplayTotals({
  summary,
  discountedBase,
  normalBase,
  usedMiles,
  origin,
  destination,
  shipDate,
  routeInsights,
}: {
  summary: Partial<PriceEstimateResponse>;
  discountedBase: number | null;
  normalBase: number | null;
  usedMiles: number | null;
  origin: ParsedRouteLocation;
  destination: ParsedRouteLocation;
  shipDate?: string;
  routeInsights?: Awaited<ReturnType<typeof postAquaRouteInsights>>;
}) {
  let resolvedRouteInsights = routeInsights ?? null;

  if (!resolvedRouteInsights && origin.postalCode && destination.postalCode) {
    resolvedRouteInsights = await postAquaRouteInsights({
      origin: {
        zip: origin.postalCode,
        city: origin.city,
        state: origin.state,
      },
      destination: {
        zip: destination.postalCode,
        city: destination.city,
        state: destination.state,
      },
      ship_date: shipDate || null,
    });
  }

  const routeEffortFactorRaw = Number(resolvedRouteInsights?.routeEffort?.factor);
  const routeEffortFactor = Number.isFinite(routeEffortFactorRaw) && routeEffortFactorRaw > 0
    ? routeEffortFactorRaw
    : 1;
  const fuelGuardFloor = computeFuelGuardFloor(usedMiles, resolvedRouteInsights);
  const pricingSummary = computeAquaDisplayPricing(
    {
      ...summary,
      discounted_estimate_total: typeof summary?.discounted_estimate_total === "number"
        ? summary.discounted_estimate_total
        : discountedBase ?? undefined,
      normal_estimate_total: typeof summary?.normal_estimate_total === "number"
        ? summary.normal_estimate_total
        : normalBase ?? undefined,
    },
    {
      routeEffortFactor,
      applyRouteEffortToPremium: true,
      minimumPremiumTotal: fuelGuardFloor,
    },
  );

  return {
    discounted: roundCurrency(pricingSummary.displayStandardTotal ?? discountedBase),
    normal: roundCurrency(pricingSummary.displayPremiumTotal ?? normalBase ?? discountedBase),
  };
}

export default function EstimatorQuote({ embedded = false }: { embedded?: boolean }) {
  // Steps simplified: 0 Locations -> 1 Vehicle Type -> 2 Estimate -> 3 Contact
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [miles, setMiles] = useState<number | null>(null);
  const [transit, setTransit] = useState<string | null>(null);
  // We only show the miles actually used for pricing; no extra provenance shown to end-users.
  // Totals from estimator API
  const [estimate, setEstimate] = useState<number | null>(null); // kept for backwards compatibility (discounted total)
  const [discountedTotal, setDiscountedTotal] = useState<number | null>(null);
  const [normalTotal, setNormalTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]); // cart of full vehicle rows
  const [estResponses, setEstResponses] = useState<any[]>([]); // raw backend responses per distinct type
  const [confidencePct, setConfidencePct] = useState<number | null>(null);

  // Rate plan selection: true = Premium (normal price), false = Economy (discounted)
  const [isPremium, setIsPremium] = useState(true);

  const selectedPerMile = useMemo(() => {
    const activeTotal = isPremium ? normalTotal : discountedTotal;
    return activeTotal != null && miles != null && miles > 0
      ? Math.round((activeTotal / miles) * 100) / 100
      : null;
  }, [discountedTotal, isPremium, miles, normalTotal]);

  // Cart modal and animation states
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const [flyingVehicle, setFlyingVehicle] = useState<string | null>(null);
  const [showAddedTooltip, setShowAddedTooltip] = useState(false);
  const cartIconRef = useRef<HTMLButtonElement>(null);

  // Dispatch custom event when step changes so parent (Astro) can react
  useEffect(() => {
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const event = new CustomEvent('form-step-changed', { detail: { step: activeStep } });
        window.dispatchEvent(event);
      });
    }
  }, [activeStep]);

  // Aggregate meta derived from backend responses
  const { overallConfidence, sampleSizeTotal } = useMemo(() => {
    const avail = estResponses.filter((r) => r?.data?.estimate_available);
    const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };
    let worst: string | null = null;
    for (const r of avail) {
      const c = String(r?.data?.confidence || '').toLowerCase();
      if (!c || typeof rank[c] === 'undefined') continue;
      if (worst == null || rank[c] < rank[worst]) worst = c;
    }
    const samples = avail.reduce((acc, r) => acc + (Number(r?.data?.sample_size) || 0), 0);
    return { overallConfidence: worst, sampleSizeTotal: samples };
  }, [estResponses]);

  // Step 1: Locations
  const step1 = useForm<Step1Values>({
    resolver: yupResolver(step1Schema),
    mode: "onChange",
    defaultValues: {
      origin_city: "",
      destination_city: "",
      origin_city__isValid: false,
      destination_city__isValid: false,
      ship_date: "",
      shipping_timeframe: "asap", // default to ASAP/2_weeks logic
    },
  });

  // Auto-calculate timeframe based on ship_date
  const shipDateVal = step1.watch('ship_date');
  useEffect(() => {
    if (!shipDateVal) return;
    const date = new Date(shipDateVal);
    if (isNaN(date.getTime())) return;
    const diff = differenceInCalendarDays(date, new Date());
    let tf = 'asap';
    if (diff <= 7) tf = 'asap';
    else if (diff <= 14) tf = '2_weeks';
    else if (diff <= 30) tf = '30_days';
    else tf = '30_plus';

    // Only update if changed to avoid loop (though setValue is stable, good practice)
    if (step1.getValues('shipping_timeframe') !== tf) {
      step1.setValue('shipping_timeframe', tf);
    }
  }, [shipDateVal, step1.setValue]);

  // Modo de selección: 'specific' (año/marca/modelo) o 'generic' (solo tipo cuando no sabe detalles)
  const [vehicleMode, setVehicleMode] = useState<'specific' | 'generic'>('specific');

  // Modal state for editing quote details in Step 2
  const [editModalOpen, setEditModalOpen] = useState(false);

  const step2 = useForm<Step2Values>({
    resolver: yupResolver((vehicleMode === 'generic' ? step2GenericSchema : step2SpecificSchema) as any),
    mode: "onChange",
    // Start with no preselected vehicle type so the user must choose explicitly
    defaultValues: { vehicle_type: "", vehicle_year: '', vehicle_make: '', vehicle_model: '', vehicle_inop: '0' },
  });
  // Reset fields not used when switching modes to avoid confusion
  useEffect(() => {
    if (vehicleMode === 'generic') {
      // Clear specific fields
      step2.setValue('vehicle_year', '');
      step2.setValue('vehicle_make', '');
      step2.setValue('vehicle_model', '');
    } else {
      // Clear generic field
      step2.setValue('vehicle_type', '');
    }
  }, [vehicleMode]);
  const [lastAddedSignature, setLastAddedSignature] = useState<string>('');

  const [transportType, setTransportType] = useState<TransportType>('open');

  const contactSchema: yup.ObjectSchema<ContactValues> = yup
    .object({
      first_name: yup
        .string()
        .required("Name is required")
        .matches(/^[a-zA-Z\s]+$/, "Name must only contain letters and spaces")
        .min(3)
        .max(20),
      phone: yup
        .string()
        .optional()
        .test("valid-phone", "Enter a valid phone number", (val) => {
          if (!val) return true;
          try { return isValidPhoneNumber(String(val)); } catch { return false; }
        }),
      email: yup.string().required("Email is required").email("Please enter a valid email address."),
      website: yup.string().max(0).optional(),
    });
  const step4 = useForm<ContactValues>({ resolver: yupResolver(contactSchema), mode: "onChange" });

  // Track last computed values to prevent redundant API calls
  const lastComputedRef = useRef<{ origin: string; dest: string; date: string } | null>(null);
  const computeRunIdRef = useRef(0);

  const computeEstimate = useCallback(async (vehiclesOverride?: VehicleRow[]) => {
    const runId = ++computeRunIdRef.current;
    const isLatestRun = () => computeRunIdRef.current === runId;
    const s1 = step1.getValues();

    // Update lastComputedRef to prevent double computation when entering Step 2
    lastComputedRef.current = {
      origin: s1.origin_city || '',
      dest: s1.destination_city || '',
      date: s1.ship_date || '',
    };

    const listToUse = vehiclesOverride || vehicles;
    // Build mixed vehicles list (generic types and specific vehicles)
    type MixedItem = (
      { kind: 'generic'; type: string; inop?: boolean; count: number } |
      { kind: 'specific'; type?: string; year?: number; make?: string; model?: string; inop?: boolean; count: number }
    );
    const genericsMap = new Map<string, MixedItem>();
    const specificsMap = new Map<string, MixedItem>();
    for (const v of listToUse) {
      const inop = (v.vehicle_inop === '1');
      const hasSpecific = !!(v.vehicle_year || v.vehicle_make || v.vehicle_model);
      if (hasSpecific) {
        const key = [v.vehicle_type || '', v.vehicle_year || '', v.vehicle_make || '', v.vehicle_model || '', inop ? '1' : '0'].join('|').toLowerCase();
        if (!specificsMap.has(key)) {
          specificsMap.set(key, {
            kind: 'specific',
            type: v.vehicle_type || undefined,
            year: v.vehicle_year ? Number(v.vehicle_year) : undefined,
            make: v.vehicle_make || undefined,
            model: v.vehicle_model || undefined,
            inop,
            count: 1,
          });
        } else {
          specificsMap.get(key)!.count += 1;
        }
      } else {
        const t = (v.vehicle_type || '').toLowerCase();
        if (!t) continue;
        const key = `${t}|${inop ? '1' : '0'}`;
        if (!genericsMap.has(key)) {
          genericsMap.set(key, { kind: 'generic', type: t, inop, count: 1 });
        } else {
          genericsMap.get(key)!.count += 1;
        }
      }
    }
    const mixedItems: MixedItem[] = [...genericsMap.values(), ...specificsMap.values()];
    setBusy(true);
    try {
      // Extract zips from inputs
      const o = parseCityStateZip(s1.origin_city || "");
      const d = parseCityStateZip(s1.destination_city || "");
      const origin_zip = o.postalCode || ((s1.origin_city || "").match(/(\d{5})/) || [""])[0];
      const destination_zip = d.postalCode || ((s1.destination_city || "").match(/(\d{5})/) || [""])[0];
      const distancePromise = distanceForLocations(s1.origin_city, s1.destination_city);
      const routeInsightsPromise = origin_zip && destination_zip
        ? postAquaRouteInsights({
            origin: {
              zip: origin_zip,
              city: o.city,
              state: o.state,
            },
            destination: {
              zip: destination_zip,
              city: d.city,
              state: d.state,
            },
            ship_date: s1.ship_date || null,
          })
        : Promise.resolve(null);
      // Unified request payload (supports generic and specific vehicles)
      // Unified request payload (supports generic and specific vehicles)
      const unifiedPayload: PriceEstimateRequest = {
        origin_zip,
        destination_zip,
        transport_type: transportType, // Use selected transport type
        shipping_timeframe: s1.shipping_timeframe,
        ship_date: s1.ship_date,
        vehicles: mixedItems.map(it => it.kind === 'generic'
          ? { type: it.type, inop: !!it.inop, count: it.count }
          : { type: it.type, year: it.year!, make: it.make!, model: it.model!, inop: !!it.inop, count: it.count }
        ),
      };

      const results: any[] = [];
      let unifiedResp: PriceEstimateResponse | null = await postPriceEstimate(unifiedPayload);
      if (!isLatestRun()) return;

      if (unifiedResp && (Array.isArray(unifiedResp.items) || typeof unifiedResp.estimate_available !== 'undefined')) {
        const items = Array.isArray(unifiedResp.items) ? unifiedResp.items : [];
        if (items.length > 0) {
          for (const it of items) {
            const label = (it.year && it.make && it.model) ? `${it.year} ${it.make} ${it.model}` : (it.type || 'vehicle');
            const count = Number(it.count || 1) || 1;
            results.push({ type: String(label), count, data: it });
          }
        } else {
          results.push({ type: 'vehicles', count: listToUse.length, data: unifiedResp });
        }
        if (!isLatestRun()) return;
        setEstResponses(results);
        const discountedSum = (typeof unifiedResp.discounted_estimate_total === 'number')
          ? Number(unifiedResp.discounted_estimate_total)
          : items.reduce((acc: number, it: any) => acc + (Number(it.discounted_estimate_total ?? it.low_estimate_total) || 0), 0);
        const normalSum = (typeof unifiedResp.normal_estimate_total === 'number')
          ? Number(unifiedResp.normal_estimate_total)
          : items.reduce((acc: number, it: any) => {
            const d2 = Number(it.discounted_estimate_total ?? it.low_estimate_total);
            const n2 = Number(it.normal_estimate_total);
            return acc + (Number.isFinite(n2) ? n2 : (Number.isFinite(d2) ? Math.round(d2 * 1.15 * 100) / 100 : 0));
          }, 0);
        let usedMiles: number | null = null;
        const requestedMiles = typeof unifiedResp.requested_route_distance_miles === 'number' ? unifiedResp.requested_route_distance_miles : undefined;
        const pricingMiles = typeof unifiedResp.distance_used_for_pricing_miles === 'number' ? unifiedResp.distance_used_for_pricing_miles : undefined;
        const refFromResp = typeof unifiedResp.reference_distance_miles === 'number' ? unifiedResp.reference_distance_miles : undefined;
        if (typeof requestedMiles === 'number') usedMiles = requestedMiles;
        else if (typeof pricingMiles === 'number') usedMiles = pricingMiles;
        else if (typeof refFromResp === 'number') usedMiles = refFromResp;
        else {
          const dist = await distancePromise;
          if (!isLatestRun()) return;
          usedMiles = dist.miles ?? null;
        }
        setMiles(usedMiles);
        const respTransitDays = typeof unifiedResp.estimated_transit_days === 'number' ? unifiedResp.estimated_transit_days : undefined;
        if (typeof respTransitDays === 'number' && Number.isFinite(respTransitDays)) setTransit(`${Math.max(0, Math.ceil(respTransitDays))} day${respTransitDays === 1 ? '' : 's'}`);
        else setTransit(estimateTransitDays(usedMiles ?? null));
        const routeInsights = await routeInsightsPromise;
        if (!isLatestRun()) return;
        const displayTotals = await resolveLandingDisplayTotals({
          summary: unifiedResp,
          discountedBase: roundCurrency(discountedSum),
          normalBase: roundCurrency(normalSum),
          usedMiles,
          origin: o,
          destination: d,
          shipDate: s1.ship_date,
          routeInsights,
        });
        if (!isLatestRun()) return;
        setDiscountedTotal(displayTotals.discounted);
        setNormalTotal(displayTotals.normal);
        setEstimate(displayTotals.discounted);
        const topPct = typeof unifiedResp.confidence_pct === 'number' ? unifiedResp.confidence_pct : null;
        if (typeof topPct === 'number') setConfidencePct(Math.max(5, Math.min(99, Math.round(topPct))));
        else if (Array.isArray(items) && items.length) {
          const totalSamples = items.reduce((acc: number, it: any) => acc + (Number(it.sample_size) || 0), 0);
          if (totalSamples > 0) {
            const num = items.reduce((acc: number, it: any) => acc + ((Number(it.confidence_pct) || 0) * (Number(it.sample_size) || 0)), 0);
            const w = Math.round(num / totalSamples);
            setConfidencePct(Math.max(5, Math.min(99, w)));
          } else {
            const firstPct = items.find((it: any) => typeof it?.confidence_pct === 'number')?.confidence_pct;
            if (typeof firstPct === 'number') setConfidencePct(Math.max(5, Math.min(99, Math.round(firstPct))));
          }
        }
      } else {
        // Backward compatibility: per-type loop
        const distinct = Array.from(new Set(listToUse.map(v => v.vehicle_type)));
        for (const vt of distinct) {
          const count = listToUse.filter(v => v.vehicle_type === vt).length;
          const legacyPayload: PriceEstimateRequest = {
            origin_zip,
            destination_zip,
            transport_type: transportType, // Use selected transport type
            vehicle_type: vt,
            inop: false,
            vehicles_count: count,
          };
          const resp = await postPriceEstimate(legacyPayload);
          if (resp) {
            results.push({ type: vt, count, data: resp });
          }
        }
        if (!isLatestRun()) return;
        setEstResponses(results);
        const avail = results.filter(r => r?.data?.estimate_available);
        const discountedSum = avail.reduce((acc, r) => acc + (Number(r.data?.discounted_estimate_total ?? r.data?.low_estimate_total) || 0), 0);
        const normalSum = avail.reduce((acc, r) => {
          const d2 = Number(r.data?.discounted_estimate_total ?? r.data?.low_estimate_total);
          const n2 = Number(r.data?.normal_estimate_total);
          return acc + (Number.isFinite(n2) ? n2 : (Number.isFinite(d2) ? Math.round(d2 * 1.15 * 100) / 100 : 0));
        }, 0);
        let usedMiles: number | null = null;
        const requestedMiles = avail.find(r => typeof r?.data?.requested_route_distance_miles === 'number')?.data?.requested_route_distance_miles;
        const pricingMiles = avail.find(r => typeof r?.data?.distance_used_for_pricing_miles === 'number')?.data?.distance_used_for_pricing_miles;
        const refFromResp = avail.find(r => typeof r?.data?.reference_distance_miles === 'number')?.data?.reference_distance_miles;
        if (typeof requestedMiles === 'number') usedMiles = requestedMiles;
        else if (typeof pricingMiles === 'number') usedMiles = pricingMiles;
        else if (typeof refFromResp === 'number') usedMiles = refFromResp;
        else {
          const dist = await distancePromise;
          if (!isLatestRun()) return;
          usedMiles = dist.miles ?? null;
        }
        setMiles(usedMiles);
        const respTransitDays = avail.find(r => typeof r?.data?.estimated_transit_days === 'number')?.data?.estimated_transit_days;
        if (typeof respTransitDays === 'number' && Number.isFinite(respTransitDays)) setTransit(`${Math.max(0, Math.ceil(respTransitDays))} day${respTransitDays === 1 ? '' : 's'}`);
        else setTransit(estimateTransitDays(usedMiles ?? null));
        const routeInsights = await routeInsightsPromise;
        if (!isLatestRun()) return;
        const displayTotals = await resolveLandingDisplayTotals({
          summary: {
            discounted_estimate_total: discountedSum,
            normal_estimate_total: normalSum,
          },
          discountedBase: roundCurrency(discountedSum),
          normalBase: roundCurrency(normalSum),
          usedMiles,
          origin: o,
          destination: d,
          shipDate: s1.ship_date,
          routeInsights,
        });
        if (!isLatestRun()) return;
        setDiscountedTotal(displayTotals.discounted);
        setNormalTotal(displayTotals.normal);
        setEstimate(displayTotals.discounted);
        const totalSamples = avail.reduce((acc, r) => acc + (Number(r?.data?.sample_size) || 0), 0);
        let weightedPct: number | null = null;
        if (totalSamples > 0) {
          const num = avail.reduce((acc, r) => acc + ((Number(r?.data?.confidence_pct) || 0) * (Number(r?.data?.sample_size) || 0)), 0);
          weightedPct = Math.round(num / totalSamples);
        } else {
          const firstPct = avail.find(r => typeof r?.data?.confidence_pct === 'number')?.data?.confidence_pct;
          weightedPct = typeof firstPct === 'number' ? Math.round(firstPct) : null;
        }
        if (typeof weightedPct === 'number') setConfidencePct(Math.max(5, Math.min(99, weightedPct)));
      }
    } finally {
      if (isLatestRun()) {
        setBusy(false);
      }
    }
  }, [step1, transportType, vehicles]);

  const onSubmitStep1 = async (data: Step1Values) => {
    void data; // validation already handled
    setActiveStep(1);
  };

  // Step 2 handlers: add to cart and next
  const addVehicleToCart = async () => {
    const ok = await step2.trigger(["vehicle_type", "vehicle_year", "vehicle_make", "vehicle_model", "vehicle_inop"]);
    if (!ok) return;
    const vals = step2.getValues();
    // Este método se mantiene para compatibilidad, pero la UX ahora auto-agrega.
    const row: VehicleRow = {
      vehicle_type: vals.vehicle_type,
      vehicle_year: vehicleMode === 'specific' ? (vals.vehicle_year || '') : '',
      vehicle_make: vehicleMode === 'specific' ? (vals.vehicle_make || '') : '',
      vehicle_model: vehicleMode === 'specific' ? (vals.vehicle_model || '') : '',
      vehicle_inop: vals.vehicle_inop || '0',
    };
    setVehicles(prev => [...prev, row]);
    setLastAddedSignature(signatureForRow(row));
    // Reset según modo
    if (vehicleMode === 'generic') {
      step2.reset({ vehicle_type: '', vehicle_year: '', vehicle_make: '', vehicle_model: '', vehicle_inop: vals.vehicle_inop || '0' });
    } else {
      step2.reset({ vehicle_type: vals.vehicle_type, vehicle_year: '', vehicle_make: '', vehicle_model: '', vehicle_inop: vals.vehicle_inop || '0' });
    }
    setTimeout(() => step2.clearErrors(), 0);
  };

  // Firma única para evitar duplicaciones accidentales
  function signatureForRow(r: VehicleRow): string {
    return `${r.vehicle_type}|${r.vehicle_year}|${r.vehicle_make}|${r.vehicle_model}|${r.vehicle_inop}`.toLowerCase();
  }

  // Auto-agregar en modo genérico cuando se selecciona el tipo
  useEffect(() => {
    if (vehicleMode !== 'generic') return;
    const vt = step2.getValues('vehicle_type');
    if (!vt) return;
    const row: VehicleRow = { vehicle_type: vt, vehicle_year: '', vehicle_make: '', vehicle_model: '', vehicle_inop: step2.getValues('vehicle_inop') || '0' };
    const sig = signatureForRow(row);
    if (sig === lastAddedSignature) return;
    setVehicles(prev => [...prev, row]);
    setLastAddedSignature(sig);
    showNotification({ text: 'Vehicle type added', icon: 'success' });
    // limpiar para permitir añadir otro tipo
    step2.setValue('vehicle_type', '');
    setTimeout(() => step2.clearErrors(), 0);
    // Trigger cart animation
    triggerCartAnimation(vt || 'Vehicle');
  }, [step2.watch('vehicle_type'), vehicleMode]);

  // Auto-agregar en modo específico cuando año+make+model completos
  useEffect(() => {
    if (vehicleMode !== 'specific') return;
    const year = step2.getValues('vehicle_year');
    const make = step2.getValues('vehicle_make');
    const model = step2.getValues('vehicle_model');
    if (!year || !make || !model) return;
    // Inferimos un tipo para cálculo si no hay uno elegido (fallback 'car')
    const inferredType = step2.getValues('vehicle_type') || 'car';
    const row: VehicleRow = { vehicle_type: inferredType, vehicle_year: year, vehicle_make: make, vehicle_model: model, vehicle_inop: step2.getValues('vehicle_inop') || '0' };
    const sig = signatureForRow(row);
    if (sig === lastAddedSignature) return;
    setVehicles(prev => [...prev, row]);
    setLastAddedSignature(sig);
    showNotification({ text: 'Specific vehicle added', icon: 'success' });
    // Reset para permitir otro
    step2.setValue('vehicle_year', '');
    step2.setValue('vehicle_make', '');
    step2.setValue('vehicle_model', '');
    setTimeout(() => step2.clearErrors(), 0);
    // Trigger cart animation
    const label = `${year} ${make} ${model}`.trim();
    triggerCartAnimation(label);
  }, [step2.watch('vehicle_year'), step2.watch('vehicle_make'), step2.watch('vehicle_model'), vehicleMode]);

  // Function to trigger the fly-to-cart animation
  const triggerCartAnimation = useCallback((vehicleLabel: string) => {
    setFlyingVehicle(vehicleLabel);
    setTimeout(() => {
      setFlyingVehicle(null);
      setCartBounce(true);
      setShowAddedTooltip(true);
      setTimeout(() => setCartBounce(false), 400);
      // Auto-hide tooltip after 3 seconds
      setTimeout(() => setShowAddedTooltip(false), 3000);
    }, 500);
  }, []);

  const proceedToEstimate = async () => {
    let listToUse = [...vehicles];

    // If cart is empty, try to validate and add current form inputs
    if (listToUse.length === 0) {
      const fieldsToValidate = vehicleMode === 'generic'
        ? ["vehicle_type", "vehicle_inop"]
        : ["vehicle_year", "vehicle_make", "vehicle_model", "vehicle_inop"];

      const ok = await step2.trigger(fieldsToValidate as any);
      if (!ok) return;

      const vals = step2.getValues();
      const row: VehicleRow = {
        vehicle_type: vals.vehicle_type || 'car',
        vehicle_year: vehicleMode === 'specific' ? (vals.vehicle_year || '') : '',
        vehicle_make: vehicleMode === 'specific' ? (vals.vehicle_make || '') : '',
        vehicle_model: vehicleMode === 'specific' ? (vals.vehicle_model || '') : '',
        vehicle_inop: vals.vehicle_inop || '0',
      };
      listToUse = [row];
      // Update UI state for consistency, though we use local var for immediate calc
      setVehicles(prev => [...prev, row]);
    }

    if (listToUse.length === 0) return;

    if (USE_PRICE_ESTIMATE_API) {
      await computeEstimate(listToUse);
    } else {
      setMiles(null);
      setTransit(null);
      setEstimate(null);
      setDiscountedTotal(null);
      setNormalTotal(null);
      setEstResponses([]);
      setConfidencePct(null);
      setBusy(false);
    }
    setActiveStep(2);
  };

  const goToContact = () => {
    setActiveStep(3);
  };

  // Auto-recompute prices in Step 2 when route changes
  const watchedOriginValid = step1.watch('origin_city__isValid');
  const watchedDestValid = step1.watch('destination_city__isValid');
  const watchedShipDate = step1.watch('ship_date');
  const watchedOrigin = step1.watch('origin_city');
  const watchedDest = step1.watch('destination_city');
  const recomputeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!USE_PRICE_ESTIMATE_API) return;
    // Only trigger recompute if we're on Step 2 (price display step)
    if (activeStep !== 2) return;
    if (!watchedOriginValid || !watchedDestValid) return;

    // Check if values actually changed from last computation
    const currentValues = {
      origin: watchedOrigin || '',
      dest: watchedDest || '',
      date: watchedShipDate || '',
    };

    const lastComputed = lastComputedRef.current;

    // If we already computed with these exact values, skip
    if (lastComputed &&
      lastComputed.origin === currentValues.origin &&
      lastComputed.dest === currentValues.dest &&
      lastComputed.date === currentValues.date) {
      return;
    }

    // Debounce recompute
    if (recomputeTimerRef.current) {
      clearTimeout(recomputeTimerRef.current);
    }
    recomputeTimerRef.current = setTimeout(() => {
      // Update last computed values before calling
      lastComputedRef.current = currentValues;
      computeEstimate();
    }, 800);

    return () => {
      if (recomputeTimerRef.current) {
        clearTimeout(recomputeTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedOrigin, watchedDest, watchedShipDate, watchedOriginValid, watchedDestValid, activeStep]);

  // Track when Step 4 becomes visible for a simple min-time anti-spam gate
  const [step4ShownAt, setStep4ShownAt] = useState<number | null>(null);
  useEffect(() => {
    if (activeStep === 3) {
      setStep4ShownAt(Date.now());
    }
  }, [activeStep]);

  const [emailSuggestion, setEmailSuggestion] = useState<string>('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'warning' | 'blocked'>('idle');
  const [emailConfirmedOverride, setEmailConfirmedOverride] = useState(false);

  const validateEmail = async (email: string): Promise<'valid' | 'blocked' | 'warning' | 'idle'> => {
    if (!email) {
      setEmailStatus('idle');
      return 'valid';
    }

    // Always validate against backend to ensure score is checked
    setEmailStatus('loading');
    try {
      const response = await fetch(apiUrl('/api/customers/validate-email-landing/'), {
        method: 'POST',
        headers: {
          'X-API-KEY': import.meta.env.PUBLIC_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      const score = typeof data.score === 'number' ? data.score : 0;

      if (score < 50) {
        setEmailStatus('blocked');
        step4.setError('email', {
          type: 'manual',
          message: 'Invalid email address.'
        });
        return 'blocked';
      }

      // Score >= 50
      if (data.suggested) {
        setEmailSuggestion(data.suggested);
        setEmailStatus('warning');
        return 'warning';
      }

      // No suggestion
      setEmailSuggestion('');

      // Gray zone: 50-69 -> Warning (ask for confirmation)
      if (score < 70) {
        setEmailStatus('warning');
        return 'warning';
      }

      // Score >= 70 -> Valid
      step4.clearErrors('email');
      setEmailStatus('valid');
      return 'valid';

    } catch (error) {
      console.error('Email validation error:', error);
      setEmailStatus('idle');
      return 'valid'; // Fallback
    }
  };

  const handleEmailConfirmation = async () => {
    const result = await Swal.fire({
      title: 'Verify Email Address',
      html: `We couldn't verify <b>${step4.getValues('email')}</b>.<br/>It might be a typo or a temporary address.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0284c7', // sky-600
      cancelButtonColor: '#64748b', // slate-500
      confirmButtonText: 'Use this email anyway',
      cancelButtonText: 'Let me check again',
      reverseButtons: true,
      focusCancel: true,
    });

    if (result.isConfirmed) {
      setEmailConfirmedOverride(true);
      step4.clearErrors('email');
      setEmailStatus('valid'); // Visually valid now
      return true;
    }
    return false;
  };

  const submitLead = async () => {
    if (submitting) return;
    const s1 = step1.getValues();
    const s2 = step2.getValues();
    const s4: any = step4.getValues();
    // Honeypot and min-time checks
    if (s4?.website && String(s4.website).trim() !== "") {
      showNotification({ text: "Error sending lead", icon: "error" });
      return;
    }
    // Reduced to 1s to avoid blocking legitimate fast users (autofill)
    if (step4ShownAt && Date.now() - step4ShownAt < 1000) {
      showNotification({ text: "Please wait a moment before submitting.", icon: "error" });
      return;
    }

    if (s4.email && !emailConfirmedOverride) {
      // If status is blocked, stop immediately
      if (emailStatus === 'blocked') {
        showNotification({ text: "Please provide a valid email address.", icon: "error" });
        return;
      }

      // If status is invalid (legacy) or warning, ask for confirmation
      if (emailStatus === 'invalid' || emailStatus === 'warning') {
        const confirmed = await handleEmailConfirmation();
        if (!confirmed) return;
      } else if (emailStatus === 'idle') {
        // Validate if not yet validated
        const status = await validateEmail(s4.email);

        if (status === 'blocked') {
          showNotification({ text: "Please provide a valid email address.", icon: "error" });
          return;
        }

        if (status === 'warning') {
          const confirmed = await handleEmailConfirmation();
          if (!confirmed) return;
        }
      }
    }

    setSubmitting(true);
    // Determine primary vehicle (first in the cart) or fallback to current step2 values
    const primaryVehicle = vehicles[0] ?? {
      vehicle_type: s2.vehicle_type,
      vehicle_year: s2.vehicle_year || '',
      vehicle_make: s2.vehicle_make || '',
      vehicle_model: s2.vehicle_model || '',
      vehicle_inop: s2.vehicle_inop || '0',
    };

    const payload: any = {
      ...s1,
      transport_type: transportType === 'open' ? "1" : "2", // 1 Open, 2 Enclosed
      ...s4,
      ship_date: formatShipDateLocal(s1.ship_date), // format here
      is_premium: isPremium, // true = Priority, false = Economy
      client_estimate: {
        miles,
        per_mile: selectedPerMile,
        total: isPremium ? normalTotal : discountedTotal, // send the selected price as total
        discounted_total: discountedTotal,
        normal_total: normalTotal,
        transit,
        vehicle_type: primaryVehicle?.vehicle_type ?? s2.vehicle_type,
        vehicle_class: primaryVehicle?.vehicle_type ?? s2.vehicle_type,
        vehicles_count: vehicles.length,
        transport_type: transportType === 'open' ? "Open" : "Enclosed",
        // include the specific primary vehicle details so backend receives year/make/model/inop
        primary_vehicle: {
          year: primaryVehicle.vehicle_year || '',
          make: primaryVehicle.vehicle_make || '',
          model: primaryVehicle.vehicle_model || '',
          inop: primaryVehicle.vehicle_inop || '0',
        },
      },
    };
    // Sanitizar vehículos para envío: si tiene datos específicos borramos vehicle_type público
    const sanitizedVehicles = vehicles.map(v => {
      const hasSpecific = (v.vehicle_year || v.vehicle_make || v.vehicle_model);
      return hasSpecific ? { ...v, vehicle_type: '' } : v;
    });
    (payload as any).Vehicles = sanitizedVehicles;
    try {
      // ship_date is already in payload from s1 spread or explicit set, but let's ensure formatted
      const formatted = { ...payload, ship_date: formatShipDateLocal(payload.ship_date) };
      const resp = await sendLeadToLanding(formatted);
      if (resp?.status === "success" && typeof resp.id !== "undefined") {
        saveNumberLead(String(resp.id));
        // Save Quote2 data if available from backend
        if (resp.signature_code) {
          saveSignatureCode(resp.signature_code);
        }
        if (resp.quote_url) {
          saveQuoteUrl(resp.quote_url);
        }
        showNotification({ text: "Success!", icon: "success" });
        saveLead?.(formatted as any);
        saveEmail?.({ ...(formatted as any), crm_lead_id: resp.id });
        saveSelectedPlan(isPremium); // Save selected plan for quote2 display
        setTimeout(() => {
          window.location.href = "/quote2";
        }, 1200);
      } else {
        showNotification({ text: "Error sending quote", icon: "error" });
        setSubmitting(false);
      }
    } catch (e) {
      showNotification({ text: "Error sending lead", icon: "error" });
      setSubmitting(false);
    }
  };

  const padding = embedded ? "p-3 sm:p-4" : "p-3 sm:p-5";
  const titleSize = embedded ? "text-xl" : "text-2xl";

  const content = (
    <div className="w-full transition-all duration-300 ease-in-out overflow-visible">
      <>
        {/* Header with title */}
        <div className={`${padding} pb-4 mb-2 border-b border-slate-200 transition-all duration-300 ease-in-out`}>
          <div className="flex items-center justify-between">
            <h1 className={`${titleSize} font-bold text-slate-800`}>
              {activeStep === 0 && 'Ship Your Car Today'}
              {activeStep === 1 && 'What Are You Shipping?'}
              {activeStep === 2 && 'Flexible and Affordable!'}
              {activeStep === 3 && 'Almost Done!'}
            </h1>
            {activeStep === 3 && (
              <div className="flex flex-shrink-0 items-center gap-2 bg-gradient-to-r from-sky-50 to-white px-3 py-1.5 rounded-lg border border-sky-100 shadow-sm">
                <div className="relative flex items-center justify-center">
                  <FaShieldAlt className="text-sky-500 text-2xl drop-shadow-sm" />
                  <div className="absolute inset-0 flex items-center justify-center pt-0.5">
                    <FaCheck className="text-white text-[10px]" />
                  </div>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-tight">Your data is</span>
                  <span className="text-[12px] text-sky-700 font-black uppercase tracking-wide">Protected</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Locations */}
        {activeStep === 0 && (
          <FormProvider {...step1}>
            <form className={`${padding} space-y-3 w-full max-w-none`} onSubmit={step1.handleSubmit(onSubmitStep1)}>
              {/* FROM / TO - always inline */}
              <div className="grid grid-cols-2 gap-2">
                <ZipcodeAutocompleteRHF fieldNames={{ value: "origin_city" }} label="From" placeholder="City/Zip" />
                <ZipcodeAutocompleteRHF fieldNames={{ value: "destination_city" }} label="To" placeholder="City/Zip" />
              </div>

              {/* Modern Date Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">When do you need pickup?</label>
                <Controller
                  control={step1.control}
                  name="ship_date"
                  render={({ field }) => {
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const thisWeek = new Date(today);
                    thisWeek.setDate(thisWeek.getDate() + 7);

                    const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');
                    const isSelected = (d: Date) => field.value === formatDate(d);

                    return (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => field.onChange(formatDate(today))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSelected(today)
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                            }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange(formatDate(tomorrow))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSelected(tomorrow)
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                            }`}
                        >
                          Tomorrow
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange(formatDate(thisWeek))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSelected(thisWeek)
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                            }`}
                        >
                          In a Week
                        </button>
                        <div className="relative flex-1 min-w-[100px]">
                          <input
                            type="date"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            min={formatDate(today)}
                            className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${field.value && !isSelected(today) && !isSelected(tomorrow) && !isSelected(thisWeek)
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400'
                              }`}
                          />
                        </div>
                      </div>
                    );
                  }}
                />
                <Controller
                  control={step1.control}
                  name="shipping_timeframe"
                  render={({ field }) => (
                    <input type="hidden" {...field} />
                  )}
                />
              </div>

              <div>
                <button className="w-full inline-flex items-center justify-center rounded-lg bg-sky-600 text-white font-semibold py-2.5 text-sm hover:bg-sky-700 transition-colors" type="submit">
                  Show My Vehicle Options
                </button>
                <p className="mt-1.5 text-[10px] text-slate-500 text-center">Takes less than a minute</p>
              </div>
            </form>
          </FormProvider>
        )}

        {/* Step 2: Vehicle details and cart */}
        {/* Step 2: Vehicle details and cart */}
        {activeStep === 1 && (
          <FormProvider {...step2}>
            <form className={`${padding} space-y-2 w-full max-w-none transition-all duration-300 ease-in-out`}>
              <fieldset className="space-y-2">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-semibold text-slate-800">Add your vehicle</legend>
                  {/* Vehicle Cart Button */}
                  <div className="relative">
                    <button
                      ref={cartIconRef}
                      type="button"
                      onClick={() => vehicles.length > 0 && setShowCartModal(true)}
                      className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 ${vehicles.length > 0
                        ? 'bg-gradient-to-r from-sky-50 to-sky-100 border-sky-300 text-sky-700 hover:border-sky-400 hover:shadow-md cursor-pointer'
                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                        } ${cartBounce ? 'scale-110 ring-4 ring-sky-200' : ''}`}
                      aria-label={`View ${vehicles.length} added vehicles`}
                      disabled={vehicles.length === 0}
                    >
                      {/* Car icon */}
                      <div className={`relative ${cartBounce ? 'animate-pulse' : ''}`}>
                        <FaCar className={`text-lg ${vehicles.length > 0 ? 'text-sky-600' : 'text-slate-400'}`} />
                        {/* Count badge */}
                        {vehicles.length > 0 && (
                          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
                            {vehicles.length}
                          </span>
                        )}
                      </div>

                      {/* Text and arrow */}
                      {vehicles.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold">View Added</span>
                          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">No vehicles yet</span>
                      )}
                    </button>

                    {/* Tooltip hint - auto-hides after 3 seconds */}
                    {showAddedTooltip && !showCartModal && (
                      <div className="absolute top-full right-0 mt-2 z-20 animate-bounce">
                        <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg shadow-lg whitespace-nowrap">
                          <span className="mr-1">✓</span> Vehicle added! Click to review
                          <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flying vehicle animation - enhanced */}
                {flyingVehicle && (
                  <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                      animation: 'flyToCartEnhanced 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      left: '50%',
                      top: '55%',
                    }}
                  >
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-sky-400">
                      <FaCar className="text-xs" />
                      <span className="max-w-[120px] truncate">{flyingVehicle}</span>
                      <span className="text-sky-200">→</span>
                    </div>
                  </div>
                )}

                {/* Transport Type - Minimalist Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransportType('open')}
                    className={`relative p-2.5 rounded-xl border-2 transition-all duration-200 ${transportType === 'open'
                      ? 'border-sky-500 bg-gradient-to-br from-sky-50 to-sky-100 shadow-md'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${transportType === 'open' ? 'bg-sky-500' : 'bg-slate-100'}`}>
                        <svg className={`w-5 h-5 ${transportType === 'open' ? 'text-white' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-bold ${transportType === 'open' ? 'text-sky-700' : 'text-slate-700'}`}>Open</p>
                        <p className="text-[9px] text-slate-500">Most popular</p>
                      </div>
                    </div>
                    {transportType === 'open' && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500"></div>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransportType('enclosed')}
                    className={`relative p-2.5 rounded-xl border-2 transition-all duration-200 ${transportType === 'enclosed'
                      ? 'border-sky-500 bg-gradient-to-br from-sky-50 to-sky-100 shadow-md'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${transportType === 'enclosed' ? 'bg-sky-500' : 'bg-slate-100'}`}>
                        <svg className={`w-5 h-5 ${transportType === 'enclosed' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-bold ${transportType === 'enclosed' ? 'text-sky-700' : 'text-slate-700'}`}>Enclosed</p>
                        <p className="text-[9px] text-slate-500">Premium</p>
                      </div>
                    </div>
                    {transportType === 'enclosed' && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500"></div>}
                  </button>
                </div>

                {/* Vehicle Mode - Segmented Control Style */}
                <div className="bg-slate-100 p-1 rounded-xl">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setVehicleMode('specific')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${vehicleMode === 'specific'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      I know my car
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleMode('generic')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${vehicleMode === 'generic'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Just the type
                    </button>
                  </div>
                </div>

                {/* Running Status - FIRST QUESTION - Minimalist Cards */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Vehicle condition</label>
                  <Controller
                    name="vehicle_inop"
                    control={step2.control}
                    defaultValue={'0'}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => field.onChange('0')}
                          className={`p-2.5 rounded-xl border-2 transition-all ${(field.value ?? '0') === '0'
                            ? 'border-green-500 bg-green-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-green-300'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${(field.value ?? '0') === '0' ? 'bg-green-500' : 'bg-slate-100'}`}>
                              <svg className={`w-4 h-4 ${(field.value ?? '0') === '0' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className={`text-xs font-bold ${(field.value ?? '0') === '0' ? 'text-green-700' : 'text-slate-600'}`}>Runs & Drives</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange('1')}
                          className={`p-2.5 rounded-xl border-2 transition-all ${(field.value ?? '0') === '1'
                            ? 'border-amber-500 bg-amber-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-amber-300'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${(field.value ?? '0') === '1' ? 'bg-amber-500' : 'bg-slate-100'}`}>
                              <svg className={`w-4 h-4 ${(field.value ?? '0') === '1' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <p className={`text-xs font-bold ${(field.value ?? '0') === '1' ? 'text-amber-700' : 'text-slate-600'}`}>Non-Running</p>
                          </div>
                        </button>
                      </div>
                    )}
                  />
                </div>

                {/* Fields in responsive layout */}
                <div className="grid grid-cols-1 gap-2">
                  {vehicleMode === 'generic' && (
                    <>
                      <div>
                        <VehicleTypeAsyncSelect
                          name="vehicle_type"
                          label="Vehicle Type"
                        />
                        <p className="text-[10px] mt-1 text-slate-500">Added automatically when selected.</p>
                      </div>
                    </>
                  )}

                  {vehicleMode === 'specific' && (
                    <>
                      {/* Year & Make Row - Using new unified /api/public/vehicle-options/ endpoint */}
                      <div className="grid grid-cols-2 gap-3">
                        <VehicleYearSelect
                          name="vehicle_year"
                          label="Year"
                          onYearChange={() => {
                            // Clear make and model when year changes
                            step2.setValue('vehicle_make', '', { shouldDirty: true, shouldValidate: false });
                            step2.setValue('vehicle_model', '', { shouldDirty: true, shouldValidate: false });
                            step2.setValue('vehicle_type', '', { shouldDirty: true, shouldValidate: false });
                          }}
                        />
                        <VehicleMakeSelect
                          name="vehicle_make"
                          label="Make"
                          year={step2.watch('vehicle_year')}
                          onMakeChange={() => {
                            // Clear model when make changes
                            step2.setValue('vehicle_model', '', { shouldDirty: true, shouldValidate: false });
                            step2.setValue('vehicle_type', '', { shouldDirty: true, shouldValidate: false });
                          }}
                        />
                      </div>
                      {/* Model Row - full width */}
                      <VehicleModelSelect
                        name="vehicle_model"
                        label="Model"
                        year={step2.watch('vehicle_year')}
                        make={step2.watch('vehicle_make')}
                        onModelSelect={(model, category) => {
                          // Automatically set vehicle_type from the model's category
                          console.log('[EstimatorQuote] Model selected:', model, 'Category:', category);
                          if (category) {
                            step2.setValue('vehicle_type', category, { shouldDirty: true, shouldValidate: false });
                          }
                        }}
                      />
                    </>
                  )}
                </div>
                {/* Botón manual removido: ahora se agregan automáticamente según modo */}

                {/* Cart Modal */}
                {showCartModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCartModal(false)}>
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-md max-h-[70vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
                        <div className="flex items-center gap-2">
                          <FaShoppingCart className="text-amber-600" />
                          <h3 className="font-bold text-slate-800">Your Vehicles ({vehicles.length})</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCartModal(false)}
                          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <FaTimes />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
                        {vehicles.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">No vehicles added yet</p>
                        ) : (
                          vehicles.map((v, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                                  <FaCar className="text-sky-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm">
                                    {v.vehicle_year || v.vehicle_make || v.vehicle_model
                                      ? `${v.vehicle_year} ${v.vehicle_make} ${v.vehicle_model}`.trim()
                                      : formatVehicleType(v.vehicle_type)}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {v.vehicle_inop === '1' ? '⚠️ Non-running' : '✓ Running'}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setVehicles(list => list.filter((_, i) => i !== idx))}
                                className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
                                title="Remove vehicle"
                              >
                                <FaTrash className="text-xs" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Modal Footer */}
                      <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setShowCartModal(false)}
                          className="w-full py-2.5 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </fieldset>
              <div className="flex gap-2 items-stretch">
                <button type="button" onClick={() => setActiveStep(0)} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back</button>
                <button className="flex-1 inline-flex items-center justify-center rounded-lg bg-sky-600 text-white font-semibold py-2.5 text-xs hover:bg-sky-700 transition-colors" type="button" disabled={busy} onClick={proceedToEstimate}>
                  {busy ? "loading..." : `Get My Estimated Price${vehicles.length > 0 ? ` · ${numberToWord(vehicles.length)}` : ''}`}
                </button>
              </div>
            </form>
          </FormProvider>
        )}

        {/* Step 3: Estimate & Rate Plan Selection - Consolidated */}
        {activeStep === 2 && (
          <FormProvider {...step1}>
            <div className={`${padding} space-y-3 w-full max-w-none`}>
              {/* Important notice - moved to top, more compact */}
              {/* <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-amber-800">
                <p className="text-[10px] leading-relaxed">
                  <span className="font-semibold">Note:</span> Estimated price based on similar orders. Vehicle size and condition may affect final cost.
                </p>
              </div> */}
              <div className="pt-3">
                <button onClick={goToContact} className="w-full inline-flex items-center justify-center rounded-lg bg-sky-600 text-white font-semibold py-2.5 text-sm hover:bg-sky-700 transition-colors" type="button" disabled={busy}>
                  {busy ? 'Updating...' : 'Lock My Quote'}
                </button>
              </div>

              {/* Rate Plan Selector with integrated shared info */}
              <RatePlanSelector
                prices={discountedTotal !== null && normalTotal !== null ? { discounted: discountedTotal, normal: normalTotal } : null}
                isPremium={isPremium}
                onPlanChange={setIsPremium}
                miles={miles}
                perMile={selectedPerMile}
                transit={transit}
                confidencePct={confidencePct}
                vehicleCount={vehicles.length || 1}
                loading={busy}
              />


              {/* Eye-Catching Edit Trigger Button */}
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="relative mt-4 w-full flex items-center justify-center gap-3 px-5 py-3 bg-gradient-to-r from-sky-50 via-sky-100 to-sky-50 rounded-xl border-2 border-sky-200 hover:border-sky-400 hover:from-sky-100 hover:via-sky-200 hover:to-sky-100 transition-all duration-300 group shadow-sm hover:shadow-md"
              >
                {/* Animated glow ring */}
                <span className="absolute inset-0 rounded-xl bg-sky-400/20 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Icon container with badge */}
                <span className="relative flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm border border-sky-200 group-hover:border-sky-300 group-hover:scale-110 transition-all">
                  <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>

                {/* Text */}
                <span className="relative flex flex-col items-start">
                  <span className="text-sm font-bold text-sky-800 group-hover:text-sky-900">Need to make changes?</span>
                  <span className="text-[11px] text-sky-600 group-hover:text-sky-700">Tap here to edit route, date, or vehicle</span>
                </span>

                {/* Arrow indicator */}
                <svg className="relative w-5 h-5 text-sky-400 group-hover:text-sky-600 group-hover:translate-x-1 transition-all ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Edit Modal */}
              {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditModalOpen(false)}>
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

                  {/* Modal */}
                  <div
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden animate-in fade-in zoom-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Edit Your Quote</h3>
                          <p className="text-xs text-slate-500">Prices update automatically</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                      >
                        <FaTimes className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-5">
                      {busy && (
                        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-sky-50 rounded-lg border border-sky-100">
                          <FaSpinner className="w-4 h-4 text-sky-500 animate-spin" />
                          <span className="text-xs text-sky-700 font-medium">Recalculating prices...</span>
                        </div>
                      )}

                      {/* Route */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 block">Route</label>
                        <div className="grid grid-cols-2 gap-3">
                          <ZipcodeAutocompleteRHF
                            fieldNames={{ value: "origin_city" }}
                            label="From"
                            placeholder="City or ZIP"
                          />
                          <ZipcodeAutocompleteRHF
                            fieldNames={{ value: "destination_city" }}
                            label="To"
                            placeholder="City or ZIP"
                          />
                        </div>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 block">Pickup Date</label>
                        <Controller
                          control={step1.control}
                          name="ship_date"
                          render={({ field }) => {
                            const today = new Date();
                            const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');
                            return (
                              <input
                                type="date"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                min={formatDate(today)}
                                className="w-full px-3 py-2.5 rounded-lg text-sm border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:outline-none transition-all"
                              />
                            );
                          }}
                        />
                      </div>

                      {/* Vehicle */}
                      {vehicles.length > 0 && (
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 block">Vehicle</label>
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <FaCar className="text-slate-400" />
                              <span className="text-sm text-slate-700">
                                {vehicles.map((v, i) => (
                                  <span key={i}>
                                    {v.vehicle_year || v.vehicle_make || v.vehicle_model
                                      ? `${v.vehicle_year} ${v.vehicle_make} ${v.vehicle_model}`.trim()
                                      : formatVehicleType(v.vehicle_type)}
                                    {i < vehicles.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setEditModalOpen(false); setActiveStep(1); setShowCartModal(true); }}
                              className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setEditModalOpen(false)}
                        className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA button */}
              <div className="pt-3">
                <button onClick={goToContact} className="w-full inline-flex items-center justify-center rounded-lg bg-sky-600 text-white font-semibold py-2.5 text-sm hover:bg-sky-700 transition-colors" type="button" disabled={busy}>
                  {busy ? 'Updating...' : 'Lock My Quote'}
                </button>
              </div>
            </div>
          </FormProvider>
        )}

        {/* Step 4 (exact path): Vehicle details */}
        {/* Contact Step */}
        {activeStep === 3 && (
          <FormProvider {...step4}>
            <form className={`${padding} space-y-5 w-full max-w-none`} onSubmit={(e) => { e.preventDefault(); void step4.handleSubmit(submitLead)(); }}>

              {/* Inline Reviews for social proof */}
              <InlineReviews className="mb-3" />

              {/* Contact Form Card - Modern Design */}
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                {/* Name Field */}
                <CustomInputOnlyText name="first_name" max={20} type="text" label="Full Name" />

                {/* Phone Field - Full width for flag dropdown space */}
                <CustomInputPhone name="phone" type="text" max={14} label="Phone Number" />

                {/* Email Field */}
                <div>
                  <CustomInput
                    name="email"
                    max={30}
                    label="Email Address"
                    skipAutoValid={true}
                    isLoading={emailStatus === 'loading'}
                    status={
                      emailStatus === 'warning' ? 'warning' :
                        emailStatus === 'valid' ? 'success' :
                          (emailStatus === 'invalid' || emailStatus === 'blocked') ? 'error' : undefined
                    }
                    rightElement={
                      emailStatus === 'warning' ? (
                        <span className="text-amber-500" title="Attention needed">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : undefined
                    }
                    onBlur={(e) => validateEmail(e.target.value)}
                    onChange={() => {
                      if (emailSuggestion) setEmailSuggestion('');
                      if (emailStatus !== 'idle') setEmailStatus('idle');
                      if (emailConfirmedOverride) setEmailConfirmedOverride(false);
                      step4.clearErrors('email');
                    }}
                  />
                  {/* Suggestion Card */}
                  {emailSuggestion && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 shadow-sm fadeInUp">
                      <div className="text-amber-500 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.387 17.387 0 005.268 0zM9.772 17.119a18.994 18.994 0 01-2.966-.231 18.992 18.992 0 01-4.245-2.381 9.712 9.712 0 006.089 6.216 12.182 12.182 0 011.122-3.604z" />
                          <path d="M2.279 12.752a9.711 9.711 0 01.945-5.003 12.754 12.754 0 004.339 2.708 18.991 18.991 0 00.214 4.772 17.165 17.165 0 01-5.498-2.477zM12 10.5a12.74 12.74 0 018.996-3.795A9.708 9.708 0 0012 2.99a9.708 9.708 0 00-8.996 3.715 12.74 12.74 0 018.996 3.795z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-amber-800 font-medium">Possible typo detected</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Did you mean <button type="button" className="font-bold underline hover:text-amber-900" onClick={() => {
                            step4.setValue('email', emailSuggestion);
                            setEmailSuggestion('');
                            setEmailStatus('valid');
                            step4.clearErrors('email');
                          }}>{emailSuggestion}</button>?
                        </p>
                      </div>
                      <button type="button" onClick={() => setEmailSuggestion('')} className="text-amber-400 hover:text-amber-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {/* Invalid Email Confirmation UI */}
                  {emailStatus === 'invalid' && !emailConfirmedOverride && (
                    <div className="mt-1 flex justify-end">
                      <button type="button" onClick={handleEmailConfirmation} className="text-[10px] text-slate-400 hover:text-slate-600 underline">
                        I am sure this email is correct
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Honeypot field to deter bots */}
              <input type="text" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" {...(step4.register as any)("website")} />

              {/* Privacy Notice - more subtle */}
              <div className="flex items-start gap-2 px-1">
                <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <small className="text-[10px] text-slate-400 leading-relaxed">
                  By providing your info and clicking through, you agree to our
                  <a href="/pdfs/Terms-and-Conditions.pdf" className="text-sky-500 hover:underline mx-0.5">Terms</a>
                  and <a href="/privacy-policy/" className="text-sky-500 hover:underline">Privacy Policy</a>.
                </small>
              </div>
              <div className="flex gap-2 items-stretch pt-1">
                <button type="button" onClick={() => setActiveStep(2)} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Back</button>
                <button id="submit_button"
                  disabled={submitting}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 text-white font-bold py-2.5 text-sm hover:bg-orange-700 transition-colors ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  type="submit"
                >
                  {submitting ? (
                    <>
                      Processing...
                      <FaSpinner className="animate-spin" />
                    </>
                  ) : (
                    <>
                      Get My Final Quote
                      <FaRegPaperPlane />
                    </>
                  )}
                </button>
              </div>
            </form>
          </FormProvider>
        )}
      </>
    </div>
  );

  if (embedded) return content;

  return <div className="bg-white rounded-xl shadow-lg border border-slate-200">{content}</div>;
}

// Ensures date formatting without timezone shifts (avoids off-by-one day)
function formatShipDateLocal(input: string | Date | null | undefined): string {
  if (!input) return "";
  // If it's a plain 'yyyy-MM-dd' string, compose MM/dd/yyyy directly
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mm, dd] = m;
      return `${mm}/${dd}/${y}`;
    }
    // Try Date parse as fallback but normalize to local date part
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
      const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const mm = String(local.getMonth() + 1).padStart(2, '0');
      const dd = String(local.getDate()).padStart(2, '0');
      const y = String(local.getFullYear());
      return `${mm}/${dd}/${y}`;
    }
    return String(input);
  }
  // It's a Date: take local Y/M/D
  const d = input as Date;
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  const y = String(local.getFullYear());
  return `${mm}/${dd}/${y}`;
}

function numberToWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return words[n] || String(n);
}
