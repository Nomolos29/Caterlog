import type { Analytics } from "@/lib/types";

export function AnalyticsStrip({ analytics }: { analytics: Analytics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <StatCard
        label="Paid Revenue"
        value={analytics.paidGrossFormatted}
        hint={`${analytics.paidOrdersCount} verified order(s)`}
        valueClass="text-emerald-400"
        emphasize
      />
      <StatCard
        label="Pending Transfers"
        value={analytics.pendingAmountFormatted}
        hint={`${analytics.pendingOrdersCount} active lock(s)`}
        valueClass="text-amber-400"
        emphasize
      />
      <StatCard
        label="Shipping Collected"
        value={analytics.shippingCollectedFormatted}
        hint="Delivery fees"
        valueClass="text-white"
      />
      <StatCard
        label="Discounts Given"
        value={analytics.discountsGivenFormatted}
        hint="Promo codes"
        valueClass="text-rose-400"
      />
      <StatCard
        label="Net Product Sales"
        value={analytics.netProductRevenueFormatted}
        hint="Excl. shipping"
        valueClass="text-sky-400"
        extraClass="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  valueClass,
  emphasize = false,
  extraClass = "",
}: {
  label: string;
  value: string;
  hint: string;
  valueClass: string;
  emphasize?: boolean;
  extraClass?: string;
}) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-3.5 ${extraClass}`}>
      <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
      <div
        className={`${emphasize ? "text-xl font-extrabold" : "text-lg font-bold"} ${valueClass} mt-1`}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
    </div>
  );
}
