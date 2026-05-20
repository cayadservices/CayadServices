import { FaRocket, FaCheck, FaHeadset, FaTag, FaClock, FaShieldAlt, FaTruck, FaPhone, FaStar, FaTimes } from "react-icons/fa";

type RatePlanSelectorProps = {
    prices: { discounted: number; normal: number } | null;
    isPremium: boolean;
    onPlanChange: (isPremium: boolean) => void;
    loading?: boolean;
    // Shared info props
    miles?: number | null;
    perMile?: number | null;
    transit?: string | null;
    confidencePct?: number | null;
    vehicleCount?: number;
};

type FeatureItem = {
    label: string;
    priority: string | boolean;
    economy: string | boolean;
};

const FEATURES: FeatureItem[] = [
    { label: "Pickup Window", priority: "1-2 days", economy: "1-5 days" },
    { label: "Dispatch Priority", priority: "First in line", economy: "Standard queue" },
    { label: "Support", priority: "VIP 24/7", economy: "Email & Chat" },
    { label: "Cancellation", priority: "Free", economy: "Free" },
    { label: "Insurance", priority: true, economy: true },
];

export default function RatePlanSelector({
    prices,
    isPremium,
    onPlanChange,
    loading = false,
    miles,
    perMile,
    transit,
    confidencePct,
    vehicleCount = 1,
}: RatePlanSelectorProps) {
    // Show skeleton loader only while a real refresh is running. The landing
    // flow can intentionally skip price estimates and still show the plan view.
    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {/* Skeleton for route info bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 rounded-lg px-3 py-2 h-8">
                    <div className="flex gap-3">
                        <div className="h-3 w-16 bg-slate-200 rounded"></div>
                        <div className="h-3 w-12 bg-slate-200 rounded"></div>
                        <div className="h-3 w-14 bg-slate-200 rounded"></div>
                    </div>
                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </div>

                {/* Skeleton for price cards */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Premium skeleton */}
                    <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                            <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        </div>
                        <div className="h-8 w-20 bg-slate-200 rounded mb-2"></div>
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-slate-200 rounded"></div>
                            <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                    {/* Economy skeleton */}
                    <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                            <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        </div>
                        <div className="h-8 w-20 bg-slate-200 rounded mb-2"></div>
                        <div className="space-y-2">
                            <div className="h-3 w-full bg-slate-200 rounded"></div>
                            <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-400">Updating...</p>
            </div>
        );
    }

    const savings = prices ? prices.normal - prices.discounted : null;

    return (
        <div className="space-y-3">
            {/* Shared Route Info - compact horizontal bar */}
            {/* <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"> */}
                {/* <div className="flex items-center gap-3 text-[11px] text-slate-600">
                    {miles != null && (
                        <span className="font-medium">{miles.toLocaleString()} mi</span>
                    )}
                    {perMile != null && (
                        <span className="text-slate-400">~${perMile}/mi</span>
                    )}
                    {transit && (
                        <span className="text-slate-500">{transit}</span>
                    )}
                    <span className="text-slate-400">{vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}</span>
                </div> */}
                {/* Confidence indicator - inline */}
                {/* {confidencePct != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Confidence</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${confidencePct}%`,
                                    backgroundColor: `hsl(${Math.round((confidencePct / 100) * 120)}, 85%, 45%)`,
                                }}
                            />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600">{confidencePct}%</span>
                    </div>
                )} */}
            {/* </div> */}

            {/* Rate Plan Selection - Two cards side by side on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Standard Priority Service (Premium) */}
                <div
                    onClick={() => onPlanChange(true)}
                    className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden group ${isPremium
                        ? 'border-sky-600 bg-gradient-to-br from-sky-50 to-white ring-2 ring-sky-100 shadow-md'
                        : 'border-slate-200 bg-white hover:border-sky-300'
                        }`}
                >
                    {/* Badge */}
                    <div className={`absolute top-0 right-0 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider flex items-center gap-1 ${isPremium ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                        <FaRocket size={8} className={isPremium ? 'text-amber-300' : ''} /> Priority
                    </div>

                    <div className="p-4 pt-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-slate-800">Premium</h4>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isPremium
                                ? 'border-sky-600 bg-sky-600'
                                : 'border-slate-300'
                                }`}>
                                {isPremium && <FaCheck className="text-white" size={10} />}
                            </div>
                        </div>

                        {/* Price */}
                        {/* <p className="text-2xl font-black text-slate-900 mb-3">${prices.normal.toFixed(0)}</p> */}

                        {/* Features */}
                        <div className="space-y-1.5 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaTruck className="text-sky-500" size={10} />
                                <span className="text-slate-700"><strong>Fast Pickup</strong> (1-2 days)</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaStar className="text-amber-500" size={10} />
                                <span className="text-slate-700"><strong>First-in-Line</strong> Dispatch</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaPhone className="text-sky-500" size={10} />
                                <span className="text-slate-700"><strong>VIP Support</strong> 24/7</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaShieldAlt className="text-emerald-500" size={10} />
                                <span className="text-slate-700">Full Insurance Included</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaCheck className="text-emerald-500" size={10} />
                                <span className="text-slate-700">Free Cancellation</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Economy Service (Discounted) */}
                <div
                    onClick={() => onPlanChange(false)}
                    className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden ${!isPremium
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white ring-2 ring-emerald-100 shadow-md'
                        : 'border-slate-200 bg-white hover:border-emerald-200'
                        }`}
                >
                    {/* Badge */}
                    <div className={`absolute top-0 right-0 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider flex items-center gap-1 ${!isPremium ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        <FaTag size={8} /> {savings != null && savings > 0 ? `Save $${savings.toFixed(0)}` : 'Save $'}
                    </div>

                    <div className="p-4 pt-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-slate-800">Standard</h4>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!isPremium
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-slate-300'
                                }`}>
                                {!isPremium && <FaCheck className="text-white" size={10} />}
                            </div>
                        </div>

                        {/* Price */}
                        {/* <p className="text-2xl font-black text-slate-900 mb-3">${prices.discounted.toFixed(0)}</p> */}

                        {/* Features */}
                        <div className="space-y-1.5 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaClock className="text-slate-400" size={10} />
                                <span className="text-slate-700"><strong>Flexible Pickup</strong> (1-5 days)</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaTruck className="text-slate-400" size={10} />
                                <span className="text-slate-700"><strong>Standard</strong> Queue</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaHeadset className="text-slate-400" size={10} />
                                <span className="text-slate-700">Email & Live Chat</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaShieldAlt className="text-emerald-500" size={10} />
                                <span className="text-slate-700">Full Insurance Included</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                                <FaCheck className="text-emerald-500" size={10} />
                                <span className="text-slate-700">Free Cancellation</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Price varies disclaimer */}
            <p className="text-[12px] text-slate-400 text-center font-semibold">
        Final price may be adapted to your needs.

</p>
        </div>
    );
}
