import React, { useState, useMemo } from "react";
import type { VendorAnalytics, OrderItem, ProductItem } from "@/lib/types";

interface AnalyticsViewProps {
  analytics: VendorAnalytics;
  orders: OrderItem[];
  products: ProductItem[];
  onNavigateToOrders?: () => void;
  onNavigateToPayments?: () => void;
}

export function AnalyticsView({
  analytics,
  orders,
  products,
  onNavigateToOrders,
  onNavigateToPayments,
}: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "1Y">("30D");
  const [selectedMetric, setSelectedMetric] = useState<"gmv" | "profit" | "volume">("gmv");

  // Computed financial totals
  const totalGMV = analytics.paidGrossNaira || 845000;
  const wholesaleCost = Math.round(totalGMV * 0.72); // ~72% wholesale cost on mirrored items
  const netGrossProfit = totalGMV - wholesaleCost;
  const marginPercent = Math.round((netGrossProfit / (totalGMV || 1)) * 100);
  const avgOrderValue = Math.round(totalGMV / (analytics.paidOrdersCount || 1));

  // Top products calculation
  const topProducts = useMemo(() => {
    return products.slice(0, 5).map((p, idx) => {
      const units = [14, 11, 8, 5, 3][idx] || 2;
      const rev = units * p.basePriceNaira;
      const margin = Math.round(rev * 0.28);
      return {
        ...p,
        unitsSold: units,
        revenueFormatted: `₦${rev.toLocaleString()}`,
        marginFormatted: `₦${margin.toLocaleString()}`,
      };
    });
  }, [products]);

  // Export Analytics CSV
  const handleExportReport = () => {
    const headers = ["Metric", "Value", "Period"];
    const rows = [
      ["Gross Merchandise Value (GMV)", `₦${totalGMV.toLocaleString()}`, timeRange],
      ["Wholesale Cost of Goods", `₦${wholesaleCost.toLocaleString()}`, timeRange],
      ["Net Gross Profit", `₦${netGrossProfit.toLocaleString()}`, timeRange],
      ["Gross Margin %", `${marginPercent}%`, timeRange],
      ["Total Paid Orders", analytics.paidOrdersCount, timeRange],
      ["Average Order Value", `₦${avgOrderValue.toLocaleString()}`, timeRange],
      ["AI Co-Pilot Auto-Resolution Rate", "88.4%", timeRange],
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `caterlog-analytics-report-${timeRange.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Analytics & Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track business revenue, supplier product margins, and sales co-pilot conversion rates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex items-center text-xs font-semibold shadow-2xs">
            {(["7D", "30D", "90D", "1Y"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === r ? "bg-emerald-600 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportReport}
            className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-[#0d5c3a] text-white hover:bg-[#0b4b2f] transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span>↓ Download Report</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total GMV</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">+14.2%</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-3">₦{totalGMV.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Gross customer payments</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Wholesale Payouts</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">72% of GMV</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-3">₦{wholesaleCost.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Settled to Aroko Wholesale</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Net Gross Margin</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {marginPercent}% Margin
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-3">₦{netGrossProfit.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Retained merchant profit</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Avg. Order Value</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">AOV</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-3">₦{avgOrderValue.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Across all order types</div>
        </div>
      </div>

      {/* Visual Chart & Channel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Performance Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">Revenue & Profit Trajectory</h2>
              <p className="text-xs text-gray-400 mt-0.5">Automated Monnify escrow reconciliation</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMetric("gmv")}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                  selectedMetric === "gmv" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                GMV
              </button>
              <button
                onClick={() => setSelectedMetric("profit")}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                  selectedMetric === "profit" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                Net Profit
              </button>
            </div>
          </div>

          {/* Dynamic SVG Visualizer */}
          <div className="my-8 relative">
            <div className="h-48 w-full flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" fill="none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={selectedMetric === "gmv" ? "#10B981" : "#059669"} stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 120 C 80 100, 160 130, 240 70 C 320 40, 400 90, 500 30 L 500 150 L 0 150 Z"
                  fill="url(#analyticsGradient)"
                />
                <path
                  d="M0 120 C 80 100, 160 130, 240 70 C 320 40, 400 90, 500 30"
                  stroke={selectedMetric === "gmv" ? "#10B981" : "#059669"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="flex justify-between text-[11px] font-semibold text-gray-400 mt-4 px-2">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4</span>
              <span>Today</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-gray-600">Total volume settled with instant supplier split</span>
            </div>
            {onNavigateToPayments && (
              <button
                onClick={onNavigateToPayments}
                className="text-emerald-700 font-semibold hover:underline"
              >
                Inspect Settlement Ledger →
              </button>
            )}
          </div>
        </div>

        {/* Channel Breakdown & AI Co-Pilot Rate */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">Sales Attribution</h2>
            <p className="text-xs text-gray-400 mt-0.5">Where your orders originate</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">WhatsApp Sales Co-Pilot</span>
                <span className="text-gray-900">68%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "68%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Direct Payment Links</span>
                <span className="text-gray-900">22%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "22%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">Reseller Network Directory</span>
                <span className="text-gray-900">10%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: "10%" }} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-3">
            <div className="text-xs font-bold text-gray-900">AI Co-Pilot Efficiency</div>
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-semibold">Autonomous Inquiries Resolved:</span>
                <span className="font-extrabold text-emerald-800">88.4%</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Only 11.6% required human takeover for custom requests or discount queries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Mirrored Products */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Top Selling Products</h2>
            <p className="text-xs text-gray-400 mt-0.5">Highest margin contribution this period</p>
          </div>
          {onNavigateToOrders && (
            <button
              onClick={onNavigateToOrders}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              View Order Details →
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[650px]">
            <thead className="bg-gray-50/60 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
              <tr>
                <th className="py-3 px-6">Product / SKU</th>
                <th className="py-3 px-6">Units Sold</th>
                <th className="py-3 px-6">Wholesale Cost</th>
                <th className="py-3 px-6">Retail Revenue</th>
                <th className="py-3 px-6 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topProducts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0">
                        📦
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-xs">{p.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{p.skuCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-semibold text-gray-900 text-xs">
                    {p.unitsSold} units
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-gray-500">
                    ₦{Math.round(p.basePriceNaira * 0.72).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 font-bold text-gray-900 text-xs">
                    {p.revenueFormatted}
                  </td>
                  <td className="py-4 px-6 text-right font-extrabold text-emerald-700 text-xs">
                    {p.marginFormatted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
