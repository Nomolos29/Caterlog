"use client";

import React, { useState } from "react";

interface MarketBoostViewProps {
  initialTab?: "visibility" | "setup" | "subscription";
}

export function MarketBoostView({ initialTab = "visibility" }: MarketBoostViewProps) {
  // Tabs: 'visibility' | 'setup' | 'subscription'
  const [activeTab, setActiveTab] = useState<"visibility" | "setup" | "subscription">(initialTab);

  // Listing status
  const [listingPublished, setListingPublished] = useState(true);
  const [showDirPreviewModal, setShowDirPreviewModal] = useState(false);
  const [showResellerModal, setShowResellerModal] = useState(false);

  // Listing setup form states
  const [businessName, setBusinessName] = useState("Aroko Wholesale");
  const [category, setCategory] = useState("Home & living");
  const [location, setLocation] = useState("Lagos, Nigeria");
  const [description, setDescription] = useState(
    "Everyday drinkware, kitchen essentials and storage for independent shops. Live inventory, clear wholesale costs and supplier-managed fulfillment."
  );
  const [moq, setMoq] = useState("1 unit");
  const [startingPrice, setStartingPrice] = useState("₦3,000");
  const [fulfillment, setFulfillment] = useState("Pickup or merchant-arranged delivery");
  const [deliveryNote, setDeliveryNote] = useState(
    "Delivery availability and fees confirmed per order. No guaranteed dates."
  );
  const [featDrinkware, setFeatDrinkware] = useState(true);
  const [featKitchen, setFeatKitchen] = useState(true);
  const [featStorage, setFeatStorage] = useState(true);
  const [featSeasonal, setFeatSeasonal] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Subscription checkout form states
  const [billingEmail, setBillingEmail] = useState("billing@aroko.example");
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  const featuredCatalogsCount = [featDrinkware, featKitchen, featStorage, featSeasonal].filter(Boolean).length;

  const handlePayAndActivate = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaymentSuccess(true);
      setListingPublished(true);
      setTimeout(() => {
        setActiveTab("visibility");
        setPaymentSuccess(false);
      }, 1200);
    }, 1200);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 16: Market Boost · Subscription checkout                            */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "subscription") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Market Boost / Subscription</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Activate Market Boost
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            A supplier subscription for wholesale directory visibility—not a reseller commission.
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("setup")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Listing setup
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Subscription
          </button>
          <button
            onClick={() => setActiveTab("visibility")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Visibility &amp; performance
          </button>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selected plan card */}
            <div className="bg-[#0d5c3a] text-white rounded-2xl p-6 shadow-xs space-y-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-800/80 text-emerald-100 border border-emerald-700">
                Selected plan
              </span>
              <div className="text-lg font-bold">Market Boost · Monthly</div>
              <div className="text-3xl font-black">
                ₦15,000 <span className="text-xs font-normal text-emerald-200">/ month</span>
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                Directory visibility for your verified supplier profile and selected wholesale catalogs.
              </p>
            </div>

            {/* What your subscription includes */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">What your subscription includes</h3>

              <div className="space-y-2.5 text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Discoverable profile in Find suppliers</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Category, location and wholesale search visibility</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Live catalog and reseller connection entry points</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Listing views and connection performance</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <span>ℹ</span>
                  <span>Visibility, not guaranteed sales</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Market Boost does not guarantee rankings, reseller connections or orders. Supplier identity and catalog access rules still apply.
                </p>
              </div>
            </div>

            {/* Payment & activation */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Payment &amp; activation</h3>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Payment method</label>
                <select className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <option>Secure gateway checkout · Card or bank transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Billing email</label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Activation starts only after the gateway confirms payment. No payment has been taken on this review screen.
              </p>

              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <span>⚠</span>
                  <span>If payment fails</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Your listing stays a draft and hidden from discovery. Retry payment without creating another listing; existing reseller links remain intact.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Order summary & After payment */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Order summary</h3>

              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Business</span>
                  <span className="font-semibold text-gray-900">Aroko Wholesale</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-semibold text-gray-900">Market Boost Monthly</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Subscription</span>
                  <span className="font-semibold text-gray-900">₦15,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Additional checkout fees</span>
                  <span className="font-semibold text-gray-900">₦0</span>
                </div>
                <div className="py-2.5 flex justify-between text-sm font-bold text-gray-900">
                  <span>Total billed today</span>
                  <span>₦15,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Billing frequency</span>
                  <span className="font-semibold text-gray-900">Every month</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Initial period</span>
                  <span className="font-semibold text-gray-900">3 Nov–3 Dec 2026</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Next renewal</span>
                  <span className="font-semibold text-gray-900">3 Dec · ₦15,000</span>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] leading-relaxed">
                  I agree to a monthly charge of ₦15,000. Cancel renewal before the next billing date to avoid the next charge.
                </span>
              </label>

              {paymentSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  ✓ Payment confirmed! Market Boost is now activated.
                </div>
              )}

              <button
                onClick={handlePayAndActivate}
                disabled={!agreedTerms || paying}
                className="w-full py-2.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                {paying ? "Processing payment..." : "Pay ₦15,000 & activate"}
              </button>

              <button
                onClick={() => setActiveTab("setup")}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                Back to listing
              </button>
            </div>

            {/* After payment card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">After payment</h3>
              <p className="text-gray-600 leading-relaxed">
                Once payment is server-confirmed, Market Boost becomes active. Review and publish your prepared listing to make it discoverable.
              </p>
              <button
                onClick={() => setActiveTab("visibility")}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold block pt-1 text-left"
              >
                Next → Visibility &amp; performance
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 14: Market Boost · Listing setup                                    */
  /* -------------------------------------------------------------------------- */
  if (activeTab === "setup") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        {/* Header */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Market Boost / Listing setup</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Set up your wholesale listing
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Help resellers discover Aroko Wholesale in the supplier directory.
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
          <button
            onClick={() => setActiveTab("setup")}
            className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
          >
            Listing setup
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Subscription
          </button>
          <button
            onClick={() => setActiveTab("visibility")}
            className="pb-2.5 text-gray-500 hover:text-gray-900"
          >
            Visibility &amp; performance
          </button>
        </div>

        {/* Eligibility Banner */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
          <div className="font-bold text-emerald-900 flex items-center gap-1.5">
            <span>✓</span>
            <span>Verified identity · Eligible for Market Boost</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Aroko Wholesale meets the identity requirement. Publish a listing after activating your subscription; preview it before it becomes visible.
          </p>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business information */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Business information</h3>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Supplier business name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Home &amp; living</option>
                    <option>Kitchenware</option>
                    <option>Storage &amp; Organization</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>Lagos, Nigeria</option>
                    <option>Abuja, Nigeria</option>
                    <option>Ibadan, Nigeria</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Wholesale description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Wholesale terms */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Wholesale terms</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Minimum order quantity</label>
                  <input
                    type="text"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Starting wholesale price</label>
                  <input
                    type="text"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Fulfillment options</label>
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
                >
                  <option>Pickup or merchant-arranged delivery</option>
                  <option>Nationwide shipping only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Delivery note</label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            {/* Catalogs to feature */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-gray-900">Catalogs to feature</h3>

              <div className="divide-y divide-gray-100">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Drinkware · 8 products</div>
                    <div className="text-[11px] text-gray-400">Open to resellers · Includes Stainless flask at ₦8,000.</div>
                  </div>
                  <button
                    onClick={() => setFeatDrinkware(!featDrinkware)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      featDrinkware ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        featDrinkware ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Kitchen essentials · 10 products</div>
                    <div className="text-[11px] text-gray-400">Open to resellers · From ₦6,000.</div>
                  </div>
                  <button
                    onClick={() => setFeatKitchen(!featKitchen)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      featKitchen ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        featKitchen ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Storage &amp; organisation · 6 products</div>
                    <div className="text-[11px] text-gray-400">Open to resellers · From ₦3,000.</div>
                  </div>
                  <button
                    onClick={() => setFeatStorage(!featStorage)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      featStorage ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        featStorage ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Seasonal bundles</div>
                    <div className="text-[11px] text-gray-400">Restricted catalog · Not included in directory listing.</div>
                  </div>
                  <button
                    onClick={() => setFeatSeasonal(!featSeasonal)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      featSeasonal ? "bg-[#0d5c3a]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        featSeasonal ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Listing preview & Publish checklist */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div>
                <h3 className="text-xs font-bold text-gray-900">Listing preview</h3>
                <p className="text-[11px] text-gray-400">What resellers see in Find suppliers</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-3xl mx-auto">
                  🧴
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{businessName}</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Verified business
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">{location} · {category}</p>
                <p className="text-gray-700 text-xs line-clamp-3">{description}</p>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Open to resellers
                  </span>
                </div>
                <div className="divide-y divide-gray-100 text-[11px] pt-1">
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Catalogs featured</span>
                    <span className="font-semibold text-gray-900">{featuredCatalogsCount} catalogs</span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Wholesale from</span>
                    <span className="font-semibold text-gray-900">{startingPrice}</span>
                  </div>
                  <div className="py-1 flex justify-between">
                    <span className="text-gray-400">Minimum order</span>
                    <span className="font-semibold text-gray-900">{moq}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDirPreviewModal(true)}
                  className="w-full py-1.5 border border-gray-200 rounded text-gray-700 text-xs hover:bg-gray-50"
                >
                  View full preview ↗
                </button>
              </div>
            </div>

            {/* Publish checklist card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Publish checklist</h3>

              <div className="space-y-2 text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Business identity verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Catalogs &amp; terms selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="text-gray-900 font-medium">Activate Market Boost subscription</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                Saving a draft does not charge your account. Your listing remains hidden until the subscription is active and you publish.
              </p>

              <button
                onClick={() => setActiveTab("subscription")}
                className="w-full py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Continue to subscription →
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 py-3 px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 z-30 shadow-lg text-xs">
          <span className="text-gray-400 text-[11px]">
            Activate your subscription to enable publishing.
          </span>
          <div className="flex items-center gap-2">
            {draftSaved && (
              <span className="text-xs font-semibold text-emerald-700 mr-2">
                ✓ Draft saved
              </span>
            )}
            {publishSuccess && (
              <span className="text-xs font-semibold text-emerald-700 mr-2">
                ✓ Listing published to supplier directory!
              </span>
            )}
            <button
              onClick={() => {
                setDraftSaved(true);
                setTimeout(() => setDraftSaved(false), 2000);
              }}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Save draft
            </button>
            <button
              onClick={() => setActiveTab("subscription")}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0d5c3a] hover:bg-[#0b4b2f] rounded-lg transition-colors shadow-xs"
            >
              Review &amp; continue
            </button>
            <button
              onClick={() => {
                setPublishSuccess(true);
                setListingPublished(true);
                setTimeout(() => {
                  setPublishSuccess(false);
                  setActiveTab("visibility");
                }, 1500);
              }}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
            >
              Publish listing
            </button>
          </div>
        </div>

        {/* Directory Preview Modal */}
        {showDirPreviewModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Directory Card Preview</h3>
                <button onClick={() => setShowDirPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-gray-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-base font-bold text-gray-900">{businessName}</div>
                    <div className="text-xs text-gray-500">{location} · {category}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-gray-700">{description}</p>
                <div className="text-xs font-semibold text-emerald-700">
                  {startingPrice} starting wholesale price · {moq} MOQ
                </div>
              </div>
              <button
                onClick={() => setShowDirPreviewModal(false)}
                className="w-full py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 15: Market Boost · Visibility and performance (Default View)         */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Market Boost / Visibility &amp; performance</div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Visibility &amp; performance</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            See how resellers discover and connect with Aroko Wholesale.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("setup")}
          className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors self-start sm:self-center"
        >
          Edit listing
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6">
        <button
          onClick={() => setActiveTab("setup")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Listing setup
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className="pb-2.5 text-gray-500 hover:text-gray-900"
        >
          Subscription
        </button>
        <button
          onClick={() => setActiveTab("visibility")}
          className="pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold"
        >
          Visibility &amp; performance
        </button>
      </div>

      {/* Directory listing banner card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">Aroko Wholesale · Directory listing</h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                listingPublished ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {listingPublished ? "Active · Published" : "Unpublished · Draft"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Home &amp; living · Lagos, Nigeria · 3 catalogs · 24 products
          </p>
          <div className="text-[11px] text-gray-400 mt-0.5">
            Subscription active: 3 Nov–3 Dec 2026 · Last published today
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <div className="text-gray-400">Next renewal</div>
            <div className="font-semibold text-gray-900 mt-0.5">3 Dec 2026</div>
          </div>
          <div>
            <div className="text-gray-400">Monthly charge</div>
            <div className="font-bold text-gray-900 mt-0.5">₦15,000</div>
          </div>
          <button
            onClick={() => setActiveTab("subscription")}
            className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Manage renewal
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0d5c3a] text-white rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-emerald-100 font-medium">Listing discoveries</div>
          <div className="text-3xl font-extrabold mt-1">240</div>
          <div className="text-[11px] text-emerald-200 mt-2">Search appearances · Today, 3 Nov</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Profile views</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">60</div>
          <div className="text-[11px] text-gray-400 mt-2">25% of discoveries</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Connected resellers</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">1</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-2">1.7% of profile views</div>
        </div>
      </div>

      {/* 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Discovery to connection funnel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Discovery to connection</h3>
              <p className="text-[11px] text-gray-400">Today · 3 Nov 2026 · Since activation</p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Discovered in directory</span>
                  <span className="font-bold text-gray-900">240</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0d5c3a] rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Viewed supplier profile</span>
                  <span className="font-bold text-gray-900">60</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0d5c3a] rounded-full w-[25%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5 font-medium">
                  <span className="text-gray-700">Connected &amp; mirrored</span>
                  <span className="font-bold text-gray-900">1</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0d5c3a] rounded-full w-[4%]" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 pt-1">
              Conversion: 1 connected reseller ÷ 60 profile views = 1.7%. A connection is not a guaranteed sale.
            </p>
          </div>

          {/* Connected through your listing table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Connected through your listing</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Reseller</th>
                    <th className="px-4 py-3">Connected</th>
                    <th className="px-4 py-3">Linked Products</th>
                    <th className="px-5 py-3 text-right">Paid Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  <tr
                    onClick={() => setShowResellerModal(true)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-semibold text-gray-900">Nia Stores ↗</td>
                    <td className="px-4 py-3.5 text-gray-500">3 Nov 2026</td>
                    <td className="px-4 py-3.5">3 products</td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">₦50,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowResellerModal(true)}
                className="text-xs text-gray-700 hover:text-gray-900 font-medium"
              >
                Manage reseller relationship →
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Listing visibility & Renewal preferences */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-gray-900">Listing visibility</h3>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Directory</span>
                <span className={listingPublished ? "font-semibold text-emerald-700" : "font-semibold text-gray-400"}>
                  {listingPublished ? "Visible" : "Hidden"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Supplier profile</span>
                <span className={listingPublished ? "font-semibold text-emerald-700" : "font-semibold text-gray-400"}>
                  {listingPublished ? "Published" : "Draft"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Catalog access</span>
                <span className="font-semibold text-gray-900">Open catalogs only</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowDirPreviewModal(true)}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg"
              >
                Preview directory listing
              </button>
              <button
                onClick={() => setListingPublished(!listingPublished)}
                className={`w-full py-2 border font-medium rounded-lg transition-colors ${
                  listingPublished
                    ? "border-gray-200 hover:bg-gray-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {listingPublished ? "Unpublish listing" : "Publish listing"}
              </button>
            </div>
          </div>

          {/* Renewal preferences card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-gray-900">Renewal preferences</h3>

            <div className="divide-y divide-gray-100">
              <div className="py-2 flex justify-between items-center">
                <span className="text-gray-500">Automatic renewal</span>
                <button
                  onClick={() => setAutoRenew(!autoRenew)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    autoRenew ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {autoRenew ? "On" : "Off"}
                </button>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500">Payment source</span>
                <span className="font-semibold text-gray-900">Gateway authorization</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              You can turn off renewal and remain visible until the current paid period expires.
            </p>

            <button
              onClick={() => setActiveTab("subscription")}
              className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg"
            >
              Manage subscription
            </button>
          </div>
        </div>
      </div>

      {/* Expired-listing state banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Expired-listing state · separate scenario
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            Expired · Hidden
          </span>
        </div>

        <p className="text-gray-600 leading-relaxed">
          If renewal is not completed after 3 Dec, this listing is hidden from new directory discovery. Existing supplier–reseller relationships and linked products are not deleted. Nia Stores remains connected; paid orders still need fulfillment.
        </p>

        <button
          onClick={() => setActiveTab("subscription")}
          className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
        >
          Renew for ₦15,000/month
        </button>
      </div>

      {/* Modals for Reseller & Preview */}
      {showResellerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Reseller: Nia Stores</h3>
              <button onClick={() => setShowResellerModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2 text-gray-700">
              <p><strong>Status:</strong> Active &amp; Mirrored</p>
              <p><strong>Connected Date:</strong> 3 Nov 2026</p>
              <p><strong>Mirrored Catalogs:</strong> Drinkware, Kitchen essentials, Storage (3 items)</p>
              <p><strong>Paid Sales Generated:</strong> ₦50,000 (3 orders)</p>
              <p><strong>Latest Fulfillment:</strong> Order CT-1042 (2 units stainless flask)</p>
            </div>
            <button
              onClick={() => setShowResellerModal(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showDirPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Directory Card Preview</h3>
              <button onClick={() => setShowDirPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-gray-50/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-base font-bold text-gray-900">{businessName}</div>
                  <div className="text-xs text-gray-500">{location} · {category}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Verified
                </span>
              </div>
              <p className="text-xs text-gray-700">{description}</p>
              <div className="text-xs font-semibold text-emerald-700">
                {startingPrice} starting wholesale price · {moq} MOQ
              </div>
            </div>
            <button
              onClick={() => setShowDirPreviewModal(false)}
              className="w-full py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
