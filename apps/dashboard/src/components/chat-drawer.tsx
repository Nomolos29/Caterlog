"use client";

import React, { useState, useRef, useEffect } from "react";
import type { BuyerSession, ChatMessage, Order, Product, Vendor } from "@/lib/types";
import { CloseIcon, WhatsAppBadgeIcon } from "./icons";
import { resolveImageUrl } from "@/lib/api";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  orders?: Order[];
  products?: Product[];
  vendor?: Vendor;
  activeBuyerSession?: BuyerSession | null;
  onSendVendorKeyword: (text: string, attachedImage?: string) => Promise<void>;
  onSendBuyerInquiry: (
    text: string,
    phash?: string,
    buyerPhone?: string,
    buyerName?: string,
    attachedImageUrl?: string
  ) => Promise<void>;
  onSendVendorManualEcho: (text: string, buyerPhone?: string) => Promise<void>;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
}

const BUYER_PRESETS = [
  { name: "Chidinma Okafor", phone: "+2348099887766" },
  { name: "Babatunde Adebayo", phone: "+2348123456789" },
];

export function ChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  orders = [],
  products = [],
  vendor,
  activeBuyerSession,
  onSendVendorKeyword,
  onSendBuyerInquiry,
  onSendVendorManualEcho,
  onSimulateTransfer,
}: ChatDrawerProps) {
  // Mode: "BUYER_SHOP_WA" = Customer Shopping Mode | "VENDOR_ADMIN_WA" = Store Owner Mode
  const [activeChannel, setActiveChannel] = useState<"BUYER_SHOP_WA" | "VENDOR_ADMIN_WA">("BUYER_SHOP_WA");
  // Sender role when in customer mode: simulate the customer or reply as the vendor store owner
  const [senderRole, setSenderRole] = useState<"CUSTOMER" | "VENDOR_ASSIST">("CUSTOMER");
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [sending, setSending] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setAttachedImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Phone simulator state for customer mode
  const [selectedBuyerIndex, setSelectedBuyerIndex] = useState(0); // 0 = Chidinma, 1 = Babatunde, 2 = Custom
  const [customPhone, setCustomPhone] = useState("+2348011223344");
  const [customName, setCustomName] = useState("New Buyer");

  const currentBuyerPhone =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].phone
      : customPhone;

  const currentBuyerName =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].name
      : customName;

  const filteredMessages = chatMessages.filter((m) => m.channel === activeChannel);

  // Auto-scroll chat history smoothly to bottom on message receipt
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredMessages.length, isOpen]);

  // Check if there is an order awaiting payment (prioritize currently selected buyer)
  const pendingPaymentOrder =
    orders.find((o) => o.status === "PENDING_PAYMENT" && o.customerPhone === currentBuyerPhone) ||
    orders.find((o) => o.status === "PENDING_PAYMENT");

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSending(true);
    try {
      if (activeChannel === "VENDOR_ADMIN_WA") {
        await onSendVendorKeyword(inputText.trim(), attachedImage.trim() || undefined);
      } else if (senderRole === "VENDOR_ASSIST") {
        await onSendVendorManualEcho(inputText.trim(), currentBuyerPhone);
      } else {
        await onSendBuyerInquiry(
          inputText.trim(),
          undefined,
          currentBuyerPhone,
          currentBuyerName,
          attachedImage.trim() || undefined
        );
      }
      setInputText("");
      setAttachedImage("");
    } finally {
      setSending(false);
    }
  };

  const handleSimulatePayment = async (order: Order) => {
    if (!onSimulateTransfer) return;
    setTransferring(true);
    try {
      const amountNaira = Number(order.totalAmountKobo) / 100;
      await onSimulateTransfer(order.shortCode, amountNaira);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 transition-opacity animate-in fade-in duration-150"
      />

      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <WhatsAppBadgeIcon className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                <span>WhatsApp Live Simulator</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[10px] text-gray-400">
                Simulates Meta Cloud API &amp; Dynamic NUBANs
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* User-Friendly Mode Switcher */}
        <div className="p-2 bg-gray-50 border-b border-gray-100 flex gap-2">
          <button
            onClick={() => setActiveChannel("BUYER_SHOP_WA")}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer text-left ${
              activeChannel === "BUYER_SHOP_WA"
                ? "bg-white text-emerald-800 shadow-xs border border-gray-200"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>🛍️</span>
              <span>Customer Mode</span>
            </div>
            <div className="text-[10px] font-normal text-gray-400 mt-0.5">
              Shop, order &amp; pay
            </div>
          </button>

          <button
            onClick={() => setActiveChannel("VENDOR_ADMIN_WA")}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer text-left ${
              activeChannel === "VENDOR_ADMIN_WA"
                ? "bg-white text-emerald-800 shadow-xs border border-gray-200"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>👑</span>
              <span>Store Owner Mode</span>
            </div>
            <div className="text-[10px] font-normal text-gray-400 mt-0.5">
              Manage stock &amp; fees
            </div>
          </button>
        </div>

        {/* Phone Identity Bar */}
        <div className="px-3 py-2 bg-gray-100/70 border-b border-gray-200 text-xs">
          {activeChannel === "BUYER_SHOP_WA" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-600">
                  Simulating Customer:
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  {currentBuyerName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                {BUYER_PRESETS.map((p, idx) => (
                  <button
                    key={p.phone}
                    onClick={() => setSelectedBuyerIndex(idx)}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer ${
                      selectedBuyerIndex === idx
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {p.name.split(" ")[0]} ({p.phone.slice(-4)})
                  </button>
                ))}
                <button
                  onClick={() => setSelectedBuyerIndex(BUYER_PRESETS.length)}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedBuyerIndex === BUYER_PRESETS.length
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Custom #
                </button>
              </div>

              {selectedBuyerIndex === BUYER_PRESETS.length && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Phone: +234..."
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-900"
                  />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-900"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">
                Store Owner Identity:
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                {vendor?.whatsappPhone || "+2348101123098"} (✓ Verified)
              </span>
            </div>
          )}
        </div>

        {/* Co-Pilot & Vendor Assistance Sync Status Bar */}
        {activeChannel === "BUYER_SHOP_WA" && (
          <div className="px-3 py-2 border-b text-xs flex items-center justify-between gap-2 transition-all duration-200">
            {activeBuyerSession?.state === "NEEDS_ASSISTANCE" ? (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                    <span className="truncate">Customer Assistance Requested!</span>
                  </div>
                  <div className="text-[10px] text-amber-700 truncate mt-0.5">
                    &ldquo;{activeBuyerSession.assistanceInquiry || "Buyer requested store owner"}&rdquo;
                  </div>
                </div>
                <button
                  onClick={() => setSenderRole("VENDOR_ASSIST")}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shrink-0 cursor-pointer shadow-2xs"
                >
                  💬 Assist Now
                </button>
              </div>
            ) : activeBuyerSession?.state === "ASSISTING" || activeBuyerSession?.copilotPaused ? (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span className="truncate">Store Owner Assisting · Co-Pilot Paused</span>
                  </div>
                  <div className="text-[10px] text-blue-700 truncate mt-0.5">
                    Live 1-on-1 human support with {currentBuyerName}
                  </div>
                </div>
                <button
                  onClick={() => onSendVendorManualEcho("resume", currentBuyerPhone)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg shrink-0 cursor-pointer shadow-2xs"
                >
                  🤖 Hand Back
                </button>
              </div>
            ) : (
              <div className="w-full bg-emerald-50/70 border border-emerald-100 rounded-xl p-2 flex items-center justify-between text-[11px] text-emerald-900">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-semibold truncate">Sales Co-Pilot Active</span>
                  <span className="text-[10px] text-emerald-700 font-normal hidden sm:inline truncate">
                    (Automated orders &amp; catalog)
                  </span>
                </div>
                <button
                  onClick={() => setSenderRole((r) => (r === "CUSTOMER" ? "VENDOR_ASSIST" : "CUSTOMER"))}
                  className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer shrink-0 ml-2"
                >
                  {senderRole === "VENDOR_ASSIST" ? "Switch to Customer" : "Step in as Vendor"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1-Click Monnify Bank Transfer Simulation Card */}
        {pendingPaymentOrder && onSimulateTransfer && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-100 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900 flex items-center gap-1">
                <span>⚡</span>
                <span>Awaiting Payment: {pendingPaymentOrder.shortCode}</span>
              </span>
              <span className="font-extrabold text-emerald-800">
                ₦{(Number(pendingPaymentOrder.totalAmountKobo) / 100).toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-emerald-700 flex justify-between">
              <span>Dynamic NUBAN:</span>
              <span className="font-mono font-bold">
                {pendingPaymentOrder.accountNumber} ({pendingPaymentOrder.bankName})
              </span>
            </div>
            <button
              onClick={() => handleSimulatePayment(pendingPaymentOrder)}
              disabled={transferring}
              className="w-full bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>💳</span>
              <span>
                {transferring
                  ? "Simulating Monnify Escrow Settlement..."
                  : `Simulate ₦${(Number(pendingPaymentOrder.totalAmountKobo) / 100).toLocaleString()} Bank Transfer`}
              </span>
            </button>
          </div>
        )}

        {/* Quick Test Chips */}
        <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-1 text-[11px]">
          {activeChannel === "BUYER_SHOP_WA" ? (
            <>
              {products.length > 0 ? (
                <>
                  {products.slice(0, 2).map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        onSendBuyerInquiry(
                          `I want ${p.name}`,
                          undefined,
                          currentBuyerPhone,
                          currentBuyerName
                        )
                      }
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                    >
                      {p.variants && p.variants.length > 0
                        ? `Order ${p.name.slice(0, 12)}...`
                        : `Buy ${p.name.slice(0, 16)}...`}
                    </button>
                  ))}
                  {products.some((p) => p.variants && p.variants.length > 0) && (() => {
                    const vp = products.find((p) => p.variants && p.variants.length > 0);
                    const firstVar = vp?.variants?.[0];
                    if (!vp || !firstVar) return null;
                    return (
                      <button
                        onClick={() =>
                          onSendBuyerInquiry(
                            `I want ${vp.name} ${firstVar.name}`,
                            undefined,
                            currentBuyerPhone,
                            currentBuyerName
                          )
                        }
                        className="px-2 py-1 bg-white border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium"
                      >
                        Order {firstVar.name}
                      </button>
                    );
                  })()}
                </>
              ) : (
                <button
                  onClick={() =>
                    onSendBuyerInquiry(
                      "I want Zara Block Heel (SHOE-01)",
                      undefined,
                      currentBuyerPhone,
                      currentBuyerName
                    )
                  }
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                >
                  Order sample item
                </button>
              )}
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "Order 2 SHOE-01",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-white border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium"
              >
                Order 2 Units
              </button>
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "view cart",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-800 hover:bg-emerald-50 cursor-pointer font-medium"
              >
                🛒 View Cart
              </button>
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "checkout Lekki",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-emerald-50 border border-emerald-400 rounded text-emerald-900 hover:bg-emerald-100 cursor-pointer font-bold"
              >
                ⚡ Checkout Now
              </button>
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "track",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-purple-50 border border-purple-300 rounded text-purple-800 hover:bg-purple-100 font-medium cursor-pointer"
              >
                📍 Track Order
              </button>
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "15 Admiralty Way, Lekki Phase 1, Lagos",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-100 font-medium cursor-pointer"
              >
                🏠 Send Delivery Address
              </button>
              <button
                onClick={() =>
                  onSendBuyerInquiry(
                    "Can I talk to the store owner? I need custom sizing",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-amber-50 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 font-medium cursor-pointer"
              >
                🔔 Ask for Vendor Assistance
              </button>
              <button
                onClick={() =>
                  onSendVendorManualEcho(
                    "Hello! I am the store owner, I can definitely assist you with that.",
                    currentBuyerPhone
                  )
                }
                className="px-2 py-1 bg-blue-50 border border-blue-300 rounded text-blue-800 hover:bg-blue-100 font-medium cursor-pointer"
              >
                👤 Vendor Reply
              </button>
              <button
                onClick={() =>
                  onSendVendorManualEcho("resume", currentBuyerPhone)
                }
                className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-100 font-medium cursor-pointer"
              >
                🤖 Resume Co-Pilot
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSendVendorKeyword("#help")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                #help
              </button>
              <button
                onClick={() => onSendVendorKeyword("sales")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                sales
              </button>
              <button
                onClick={() => onSendVendorKeyword("products")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                products
              </button>
              <button
                onClick={() => onSendVendorKeyword("stock")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                stock
              </button>
              <button
                onClick={() => onSendVendorKeyword("ship Lekki 3500")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                ship Lekki 3500
              </button>
              <button
                onClick={() => onSendVendorKeyword("discount add PAYDAY 10%")}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono cursor-pointer"
              >
                discount add PAYDAY 10%
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("Zara Block Heel, #25000, sizes: 38 (2), 39 (3), 40 (5)");
                  setAttachedImage("https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80");
                }}
                className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-100 font-medium cursor-pointer"
              >
                📸 + Variable Shoes
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("Vacuum Flask, #10000, variants: 500ml #8000 (10), 750ml #10000 (15), 1000ml #12000 (5)");
                  setAttachedImage("https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60");
                }}
                className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-100 font-medium cursor-pointer"
              >
                📸 + Variable Flask
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("Mini Leather Bag, #38000, stock 6");
                  setAttachedImage("https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80");
                }}
                className="px-2 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 hover:bg-emerald-100 font-medium cursor-pointer"
              >
                📸 + Simple Bag
              </button>
            </>
          )}
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <div className="text-2xl">💬</div>
              <div className="text-xs font-semibold text-gray-600">
                No messages in this thread yet
              </div>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                {activeChannel === "BUYER_SHOP_WA"
                  ? "Send an inquiry or tap an order chip to test buyer checkout and dynamic NUBAN bank accounts."
                  : "Send owner commands like #help, sales, stock, or ship Lekki 3500 to test WhatsApp store administration."}
              </p>
            </div>
          ) : (
            filteredMessages.map((m) => {
              const isVendor = m.sender === "VENDOR";
              const isBuyer = m.sender === "BUYER";
              const isBot = m.sender === "CATERLOG_BOT";
              const isRight = activeChannel === "BUYER_SHOP_WA" ? isBuyer : isVendor;

              let bubbleBg = "bg-white text-gray-800 border border-gray-100 rounded-bl-xs";
              if (activeChannel === "BUYER_SHOP_WA") {
                if (isBuyer) {
                  bubbleBg = "bg-emerald-600 text-white rounded-br-xs";
                } else if (isVendor) {
                  bubbleBg = "bg-blue-50 text-blue-950 border border-blue-200 rounded-bl-xs shadow-xs";
                }
              } else {
                if (isVendor) {
                  bubbleBg = "bg-emerald-600 text-white rounded-br-xs";
                }
              }

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isRight ? "items-end" : "items-start"} max-w-[88%] ${isRight ? "ml-auto" : ""}`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${bubbleBg}`}
                  >
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(m.imageUrl)}
                        alt="Attachment"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80";
                        }}
                        className="w-full max-h-40 object-cover rounded-xl mb-2"
                      />
                    )}
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Interactive Tappable Quick Reply Options */}
                    {m.quickReplies && m.quickReplies.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
                        {m.quickReplies.map(
                          (qr: { label: string; replyText: string }, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => {
                                if (
                                  m.channel === "VENDOR_ADMIN_WA" ||
                                  activeChannel === "VENDOR_ADMIN_WA"
                                ) {
                                  onSendVendorKeyword(qr.replyText);
                                } else {
                                  onSendBuyerInquiry(
                                    qr.replyText,
                                    undefined,
                                    currentBuyerPhone,
                                    currentBuyerName
                                  );
                                }
                              }}
                              className="w-full text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] block transition-all cursor-pointer"
                            >
                              {qr.label}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 px-1 font-medium flex items-center gap-1">
                    {isVendor && activeChannel === "BUYER_SHOP_WA" ? (
                      <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded text-[9px]">👑 Store Owner (Vendor)</span>
                    ) : isBot ? (
                      <span className="text-emerald-700 font-semibold">🤖 Sales Co-Pilot</span>
                    ) : (
                      <span>{m.sender}</span>
                    )}
                    {m.fromPhone ? `· ${m.fromPhone}` : ""}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 space-y-2">
          {activeChannel === "BUYER_SHOP_WA" && (
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Type as:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSenderRole("CUSTOMER")}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                    senderRole === "CUSTOMER"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🛍️ Customer ({currentBuyerName.split(" ")[0]})
                </button>
                <button
                  type="button"
                  onClick={() => setSenderRole("VENDOR_ASSIST")}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                    senderRole === "VENDOR_ASSIST"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  👑 Store Owner (Assist)
                </button>
              </div>
            </div>
          )}
          {attachedImage && (
            <div className="flex items-center gap-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage}
                alt="Attachment preview"
                className="w-9 h-9 object-cover rounded-lg border border-emerald-300 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-emerald-900 truncate">
                  Photo attached
                </div>
                <div className="text-[10px] text-emerald-700 truncate">{attachedImage}</div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage("")}
                className="w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-xs cursor-pointer shrink-0"
                title="Remove photo"
              >
                ✕
              </button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {!attachedImage && (
            <div className="flex gap-1.5 items-center">
              <input
                type="url"
                placeholder={
                  activeChannel === "VENDOR_ADMIN_WA"
                    ? "Attach photo URL (or click 📷 to pick file)..."
                    : "Attach status photo/screenshot (or click 📷)..."
                }
                value={attachedImage}
                onChange={(e) => setAttachedImage(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs cursor-pointer transition-colors whitespace-nowrap"
                title="Attach photo from disk"
              >
                📷 Photo
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer transition-colors"
              title="Attach photo from disk"
            >
              📎
            </button>
            <input
              type="text"
              required
              placeholder={
                activeChannel === "VENDOR_ADMIN_WA"
                  ? "Send command (e.g. Zara Heel, #25000, sizes: 38 (2), 39 (3))..."
                  : senderRole === "VENDOR_ASSIST"
                  ? `Reply as Store Owner to ${currentBuyerName}... (Pauses Co-Pilot)`
                  : `Send message as ${currentBuyerName}...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className={`flex-1 bg-gray-50 border rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none ${
                senderRole === "VENDOR_ASSIST" && activeChannel === "BUYER_SHOP_WA"
                  ? "border-blue-300 focus:border-blue-500 bg-blue-50/20"
                  : "border-gray-200 focus:border-emerald-500"
              }`}
            />
            <button
              type="submit"
              disabled={sending}
              className={`font-bold text-xs px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition-all text-white ${
                senderRole === "VENDOR_ASSIST" && activeChannel === "BUYER_SHOP_WA"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-[#0d5c3a] hover:bg-[#0b4b2f]"
              }`}
            >
              {sending ? "..." : senderRole === "VENDOR_ASSIST" && activeChannel === "BUYER_SHOP_WA" ? "Assist" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
