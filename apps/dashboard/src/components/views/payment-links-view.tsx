import React, { useState } from "react";
import type { ProductItem, OrderItem } from "@/lib/types";

interface PaymentLinksViewProps {
  products: ProductItem[];
  orders: OrderItem[];
  vendorName: string;
}

export function PaymentLinksView({ products, orders, vendorName }: PaymentLinksViewProps) {
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);
  const [simulatedCheckoutOpen, setSimulatedCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"details" | "transfer" | "success">("details");

  const handleSelectProduct = (sku: string) => {
    setSelectedProduct(sku);
    const prod = products.find((p) => p.skuCode === sku);
    if (prod) {
      setAmount(String(prod.basePriceNaira));
      if (!description) setDescription(`Order for ${prod.name}`);
    }
  };

  const previewAmount = Number(amount) || 0;
  const previewFormatted = `₦${previewAmount.toLocaleString()}`;
  const checkoutUrl = `https://caterlog.store/pay/${encodeURIComponent(vendorName.toLowerCase().replace(/\s+/g, "-"))}?amt=${previewAmount || 10000}`;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello ${customerName || "there"}! Here is your secure Caterlog checkout link for ${previewFormatted}:\n${checkoutUrl}\n\nBank transfer to dedicated Monnify NUBAN will reserve your order immediately.`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Create Payment Link</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Generate a secure checkout link with dynamic Monnify virtual account for your customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <span>Share via WhatsApp</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-2xs transition-all"
          >
            <span>{copied ? "✓ Copied to Clipboard!" : "Generate & Copy Link"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left, Mobile Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Cols: Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-gray-900">Payment Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Adewale John"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Amount (NGN) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-bold">₦</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Select Product (Optional)
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Manual Entry (Custom Amount)</option>
              {products.map((p) => (
                <option key={p.id} value={p.skuCode}>
                  {p.skuCode} — {p.name} ({p.basePriceFormatted})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Description / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of the payment purpose..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Generated Link Display */}
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-gray-600 truncate">{checkoutUrl}</span>
            <button
              onClick={handleCopyLink}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 whitespace-nowrap px-2 py-1"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Real-Time Mobile Screen Preview (Matching Payment Link Generator.png) */}
        <div className="lg:col-span-5 flex flex-col items-center w-full">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-Time Mobile Checkout Preview</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-[310px] bg-gray-900 rounded-[40px] p-3 shadow-2xl border-4 border-gray-800">
            {/* Speaker & Camera Notch */}
            <div className="w-24 h-4 bg-gray-800 rounded-full mx-auto mb-2" />

            {/* Screen Inner */}
            <div className="bg-white rounded-[32px] p-5 text-center min-h-[440px] flex flex-col justify-between relative overflow-hidden">
              {checkoutStep === "details" && (
                <>
                  <div>
                    {/* Brand Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold text-lg mb-2">
                      🛍️
                    </div>
                    <div className="font-bold text-sm text-gray-900">{vendorName}</div>
                    <div className="text-[11px] text-gray-400">Requesting Payment</div>

                    {/* Amount */}
                    <div className="my-6">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Total Amount</div>
                      <div className="text-2xl font-black text-gray-900 mt-0.5">{previewFormatted}</div>
                    </div>

                    {/* Summary Table */}
                    <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5 text-xs text-left">
                      <div className="flex justify-between text-gray-500">
                        <span>Customer:</span>
                        <span className="font-medium text-gray-900">{customerName || "Shopper"}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Item:</span>
                        <span className="font-medium text-gray-900">{selectedProduct || "Custom Payment"}</span>
                      </div>
                      <div className="text-gray-400 text-[11px] italic mt-2 truncate">
                        {description || "No description provided"}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("transfer")}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition-colors"
                    >
                      Pay with Bank Transfer
                    </button>
                    <div className="text-[10px] text-gray-400 mt-2 font-semibold">
                      🔒 SECURED BY MONNIFY · NUBAN
                    </div>
                  </div>
                </>
              )}

              {checkoutStep === "transfer" && (
                <div className="flex flex-col justify-between h-full py-2 text-left">
                  <div>
                    <div className="text-xs font-bold text-gray-900 text-center mb-1">Transfer to Virtual Account</div>
                    <div className="text-[11px] text-gray-500 text-center mb-4">Expires in 29:54</div>

                    <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100 text-xs">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Bank Name</div>
                        <div className="font-bold text-gray-900">Wema Bank</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Account Number</div>
                        <div className="font-mono text-base font-black text-emerald-700 tracking-wider">
                          7821948301
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Account Name</div>
                        <div className="font-semibold text-gray-900">CATERLOG / {vendorName.toUpperCase()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("success")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors text-center"
                    >
                      Simulate Transfer Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("details")}
                      className="w-full bg-gray-100 text-gray-600 font-semibold text-xs py-2 rounded-xl text-center"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === "success" && (
                <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-2xl mb-3">
                    ✓
                  </div>
                  <div className="font-extrabold text-sm text-gray-900">Payment Received!</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {previewFormatted} confirmed via Monnify signed webhook.
                  </div>
                  <div className="mt-6 w-full">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("details")}
                      className="w-full bg-gray-900 text-white font-bold text-xs py-2.5 rounded-xl"
                    >
                      Reset Preview
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3 text-center">Interactive preview: Click buttons inside the phone to test.</p>
        </div>
      </div>

      {/* Bottom Table: Recent Payment Links */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Recent Payment Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[650px]">
            <thead className="bg-gray-50/60 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
              <tr>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6">Reference</th>
                <th className="py-3 px-6">Amount</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">10-Digit NUBAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.slice(0, 5).map((ord) => (
                <tr key={ord.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-gray-900 text-xs">{ord.customerName}</td>
                  <td className="py-3.5 px-6 font-mono text-xs text-gray-500">{ord.shortCode}</td>
                  <td className="py-3.5 px-6 font-bold text-gray-900 text-xs">{ord.totalAmountFormatted}</td>
                  <td className="py-3.5 px-6">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        ord.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono text-xs text-emerald-700 font-bold">
                    {ord.accountNumber}
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
