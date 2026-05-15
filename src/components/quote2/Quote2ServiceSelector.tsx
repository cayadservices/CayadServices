import { useEffect, useMemo, useState } from "react";
import { getLead, getQuoteUrl, getSelectedPlan } from "../../services/localStorage";
import { parseCityStateZip } from "../../utils/leadFormat";
import { estimateTransitDays } from "../../services/distance";
import {
    FaTruck,
    FaShieldAlt,
    FaCheck,
    FaSpinner,
    FaCreditCard,
    FaMapMarkerAlt,
    FaCar,
    FaCalendarAlt,
    FaQuoteRight,
    FaLocationArrow,
    FaClock,
    FaTag,
    FaRocket,
    FaArrowRight
} from "react-icons/fa";
import { parse, format } from "date-fns";
import RotatingTrustBadge from "./RotatingTrustBadge";

// Helper: Format date for display
function formatDateForDisplay(dateStr?: string): string {
    if (!dateStr) return 'Flexible';
    try {
        const parsed = parse(dateStr, 'MM/dd/yyyy', new Date());
        if (!isNaN(parsed.getTime())) return format(parsed, 'MMMM d, yyyy');
        const parsed2 = parse(dateStr, 'yyyy-MM-dd', new Date());
        if (!isNaN(parsed2.getTime())) return format(parsed2, 'MMMM d, yyyy');
        return dateStr;
    } catch { return dateStr; }
}

type Lead = {
    origin_city?: string;
    destination_city?: string;
    transport_type?: string;
    ship_date?: string;
    client_estimate?: {
        total?: number | null;
        discounted_total?: number | null;
        normal_total?: number | null;
        miles?: number | null;
        transit?: string | null;
        vehicle_class?: string;
        transport_type?: string;
        primary_vehicle?: {
            year?: string;
            make?: string;
            model?: string;
        };
    };
    Vehicles?: Array<{
        vehicle_type?: string;
        vehicle_year?: string;
        vehicle_make?: string;
        vehicle_model?: string;
    }>;
};

// Extender el objeto window para TypeScript
declare global {
    interface Window {
        dataLayer: any[];
    }
}

export default function Quote2ServiceSelector() {
    const [lead, setLead] = useState<Lead | null>(null);
    const [quoteUrl, setQuoteUrl] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(true);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const data = getLead();
        setLead(data ?? null);
        setQuoteUrl(getQuoteUrl());
        setIsPremium(getSelectedPlan()); // Get selected plan from localStorage
        setLoading(false);
    }, []);

    const origin = useMemo(() => parseCityStateZip(lead?.origin_city || ''), [lead]);
    const destination = useMemo(() => parseCityStateZip(lead?.destination_city || ''), [lead]);
    const vehicleName = useMemo(() => {
        const vPart = lead?.client_estimate?.primary_vehicle;
        if (vPart?.year || vPart?.make) return `${vPart.year || ''} ${vPart.make || ''} ${vPart.model || ''}`;
        const vArr = lead?.Vehicles?.[0];
        if (vArr?.vehicle_year || vArr?.vehicle_make) return `${vArr.vehicle_year || ''} ${vArr.vehicle_make || ''} ${vArr.vehicle_model || ''}`;
        return lead?.client_estimate?.vehicle_class || 'Vehicle';
    }, [lead]);

    const transportTypeLabel = lead?.transport_type === '2' ? 'Enclosed Transport' : 'Open Transport';
    const miles = lead?.client_estimate?.miles ?? 0;

    // Calculate prices
    const discountedTotal = lead?.client_estimate?.discounted_total ?? lead?.client_estimate?.total ?? null;
    const normalTotal = lead?.client_estimate?.normal_total ?? (discountedTotal ? Math.round(discountedTotal * 1.15) : null);
    const selectedPrice = isPremium ? normalTotal : discountedTotal;
    const savings = (normalTotal && discountedTotal) ? (normalTotal - discountedTotal) : 0;

    const transitTime = useMemo(() => {
        if (lead?.client_estimate?.transit) return lead.client_estimate.transit;
        return estimateTransitDays(miles);
    }, [lead?.client_estimate?.transit, miles]);

    // MODIFICADO: Función con tracking para GTM
    const handleVerifyCard = () => {
        if (quoteUrl) {
            // Push data to GTM DataLayer
            if (typeof window !== 'undefined' && window.dataLayer) {
                window.dataLayer.push({
                    event: 'purchase_intent',
                    ecommerce: {
                        value: selectedPrice,
                        currency: 'USD',
                        plan_type: isPremium ? 'Priority' : 'Economy',
                        vehicle: vehicleName,
                        items: [{
                            item_name: isPremium ? 'Priority Service' : 'Economy Service',
                            price: selectedPrice,
                            item_category: transportTypeLabel,
                            item_variant: vehicleName,
                            quantity: 1
                        }]
                    }
                });
            }
            // Abrir URL de checkout
            window.open(quoteUrl, '_blank');
        }
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto p-12 text-center">
                <FaSpinner className="animate-spin text-4xl text-sky-600 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Loading your quote...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto font-sans text-slate-800">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT COLUMN: Main Dashboard */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Header Card (Brand Blue) */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-sky-600 to-sky-700 px-6 py-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-3">
                                    <FaQuoteRight className="text-sky-300" />
                                    Your quote is on its way!
                                </h1>
                                <p className="text-sky-100 text-sm mt-1 ml-9">The price is guaranteed for 7 days after booking.</p>
                            </div>
                            <div>
                                
                            </div>
                        </div>

                        <div className="p-6 md:p-8">
                            <div className="relative mb-8">
                                {/* Mobile Line */}
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-100 -translate-y-1/2 md:hidden"></div>
                                {/* Desktop Line */}
                                <div className="absolute top-[28px] left-[60px] right-[60px] h-0.5 border-t-2 border-dashed border-slate-200 hidden md:block"></div>

                                <div className="flex flex-row justify-between items-start md:items-center gap-4 relative z-10">
                                    {/* Origin */}
                                    <div className="flex-1 flex flex-col items-center text-center gap-2">
                                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-sky-600 shadow-sm relative pr-0.5">
                                            <FaLocationArrow className="-rotate-45" size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Origin</p>
                                            <h3 className="text-sm md:text-xl font-bold text-slate-900 leading-tight">{origin.city}</h3>
                                            <p className="text-xs md:sm text-slate-500">{origin.state} {origin.postalCode}</p>
                                        </div>
                                    </div>

                                    {/* Distance Pill */}
                                    <div className="self-center bg-slate-50 border border-slate-200 px-3 py-1 rounded-full shadow-sm z-20">
                                        <span className="text-xs md:text-sm font-bold text-slate-700 whitespace-nowrap">{miles > 0 ? miles.toLocaleString() : '---'} <span className="font-normal text-slate-500">mi</span></span>
                                    </div>

                                    {/* Destination */}
                                    <div className="flex-1 flex flex-col items-center text-center gap-2">
                                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-emerald-600 shadow-sm">
                                            <FaMapMarkerAlt size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Destination</p>
                                            <h3 className="text-sm md:text-xl font-bold text-slate-900 leading-tight">{destination.city}</h3>
                                            <p className="text-xs md:text-sm text-slate-500">{destination.state} {destination.postalCode}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><FaCar /> Vehicle</span>
                                    <span className="text-sm font-semibold text-slate-700 truncate" title={vehicleName}>{vehicleName}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><FaCalendarAlt /> Date</span>
                                    <span className="text-sm font-semibold text-slate-700">{formatDateForDisplay(lead?.ship_date)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><FaTruck /> Service</span>
                                    <span className="text-sm font-semibold text-slate-700">{transportTypeLabel}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><FaClock /> Transit</span>
                                    <span className="text-sm font-semibold text-slate-700">{transitTime || '---'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Selected Plan Display */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            Your Selected Plan
                        </h2>

                        <div className={`rounded-2xl border-2 overflow-hidden ${isPremium
                            ? 'border-sky-600 bg-white shadow-lg'
                            : 'border-emerald-500 bg-white shadow-lg'
                            }`}>
                            {isPremium ? (
                                <div className="p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                                            <FaRocket className="text-sky-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-sky-900">Standard Priority Service</h3>
                                            <p className="text-xs text-sky-600">Fast pickup • VIP Support</p>
                                        </div>
                                        {/* <span className="ml-auto bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                            <FaCheck size={10} /> Selected
                                        </span> */}
                                    </div>
                                    {/* <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-900">${normalTotal?.toFixed(0) ?? '---'}</span>
                                        <span className="text-sm text-slate-500">USD</span>
                                    </div> */}
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <FaTag className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">Economy Service</h3>
                                            <p className="text-xs text-emerald-600">Flexible pickup • Save ${savings.toFixed(0)}</p>
                                        </div>
                                        <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                            <FaCheck size={10} /> Selected
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-900">${discountedTotal?.toFixed(0) ?? '---'}</span>
                                        <span className="text-sm text-slate-500">USD</span>
                                        {normalTotal && (
                                            <span className="text-sm text-slate-400 line-through ml-2">${normalTotal.toFixed(0)}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Summary & CTA */}
                {/* <div className="lg:col-span-4 space-y-6">

                    <div className="bg-white rounded-3xl shadow-lg shadow-sky-900/5 border border-slate-100 p-6 md:p-8">
                        <div className="text-center mb-6">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Estimated</p>
                            <p className="text-5xl font-black text-slate-900 tracking-tight">
                                ${selectedPrice?.toFixed(0) ?? '---'}
                            </p>
                            {isPremium ? (
                                <span className="inline-block mt-2 bg-sky-100 text-sky-700 text-xs font-bold px-2 py-1 rounded-lg">
                                    Priority Service
                                </span>
                            ) : (
                                <span className="inline-block mt-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg">
                                    Savings Applied
                                </span>
                            )}
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                                <span className="text-slate-500">Service Class</span>
                                <span className="font-medium text-slate-900">{isPremium ? 'Priority / Fast' : 'Economy / Flexible'}</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                                <span className="text-slate-500">Insurance</span>
                                <span className="font-medium text-emerald-600">Included</span>
                            </div>
                            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                                <span className="text-slate-500">Due Today</span>
                                <span className="font-medium text-slate-900">$0.00</span>
                            </div>
                        </div>

                        <button
                            onClick={handleVerifyCard}
                            disabled={!quoteUrl}
                            className="w-full h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            <FaCreditCard className="text-amber-200 group-hover:text-white transition-colors" />
                            <span>Verify Your Card Info</span>
                        </button>

                        <p className="text-xs text-center text-slate-400 mt-4 leading-relaxed">
                            No payment is required today. We only verify your card to secure your spot.
                        </p>

                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                                By clicking "Verify Your Card Info", you agree to our{' '}
                                <a href="/pdfs/Terms-and-Conditions.pdf" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline font-medium">
                                    Terms and Conditions
                                </a>
                                {' '}and{' '}
                                <a href="/pdfs/Terms-of-use.pdf" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline font-medium">
                                    Terms of Use
                                </a>.
                            </p>
                        </div>
                    </div>

                    <RotatingTrustBadge />
                </div> */}

            </div>

            {/* Mobile Bottom Bar (Fixed) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50 lg:hidden shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Total</p>
                        <p className="text-2xl font-black text-slate-900">${selectedPrice?.toFixed(0) ?? '---'}</p>
                    </div>
                    <button
                        onClick={handleVerifyCard}
                        disabled={!quoteUrl}
                        className="flex-1 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                    >
                        Verify Card <FaArrowRight size={12} className="opacity-70" />
                    </button>
                </div>
            </div>
            <div className="h-24 lg:hidden"></div>

        </div>
    );
}