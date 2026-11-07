"use client";

import React, { useState } from "react";
import type { ChatMessage, Order, Product, Vendor } from "@/lib/types";
import { CloseIcon, WhatsAppBadgeIcon } from "./icons";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  orders?: Order[];
  products?: Product[];
  vendor?: Vendor;
  onSendVendorKeyword: (text: string, attachedImage?: string) => Promise<void>;
  onSendBuyerInquiry: (
    text: string,
    phash?: string,
    buyerPhone?: string,
    buyerName?: string
  ) => Promise<void>;
  onSendVendorManualEcho: (text: string) => Promise<void>;
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
  onSendVendorKeyword,
  onSendBuyerInquiry,
  onSendVendorManualEcho,
  onSimulateTransfer,
}: ChatDrawerProps) {
  // Mode: "BUYER_SHOP_WA" = Customer Shopping Mode | "VENDOR_ADMIN_WA" = Store Owner Mode
  const [activeChannel, setActiveChannel] = useState<"BUYER_SHOP_WA" | "VENDOR_ADMIN_WA">("BUYER_SHOP_WA");
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [sending, setSending] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Phone simulator state for customer mode
  const [selectedBuyerIndex, setSelectedBuyerIndex] = useState(0); // 0 = Chidinma, 1 = Babatunde, 2 = Custom
  const [customPhone, setCustomPhone] = useState("+2348011223344");
  const [customName, setCustomName] = useState("New Buyer");

  if (!isOpen) return null;

  const currentBuyerPhone =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].phone
      : customPhone;

  const currentBuyerName =
    selectedBuyerIndex < BUYER_PRESETS.length
      ? BUYER_PRESETS[selectedBuyerIndex].name
      : customName;

  const filteredMessages = chatMessages.filter((m) => m.channel === activeChannel);

  // Check if there is an order awaiting payment
  const pendingPaymentOrder = orders.find((o) => o.status === "PENDING_PAYMENT");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSending(true);
    try {
      if (activeChannel === "VENDOR_ADMIN_WA") {
        await onSendVendorKeyword(inputText.trim(), attachedImage.trim() || undefined);
      } else {
        await onSendBuyerInquiry(
          inputText.trim(),
          undefined,
          currentBuyerPhone,
          currentBuyerName
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
                products.slice(0, 2).map((p) => (
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
                    Buy {p.name.slice(0, 16)}...
                  </button>
                ))
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
                    "Lekki",
                    undefined,
                    currentBuyerPhone,
                    currentBuyerName
                  )
                }
                className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 cursor-pointer"
              >
                Select Lekki
              </button>
              <button
                onClick={() =>
                  onSendVendorManualEcho("Hold on, let me check the physical store!")
                }
                className="px-2 py-1 bg-white border border-gray-200 rounded text-amber-700 hover:bg-amber-50 cursor-pointer"
              >
                Simulate Vendor Phone Reply
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
              const isBot = m.sender === "CATERLOG_BOT";
              const isUser = !isBot;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[88%] ${isUser ? "ml-auto" : ""}`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-xs"
                        : "bg-white text-gray-800 border border-gray-100 rounded-bl-xs"
                    }`}
                  >
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt="Attachment"
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
                              onClick={() =>
                                onSendBuyerInquiry(
                                  qr.replyText,
                                  undefined,
                                  currentBuyerPhone,
                                  currentBuyerName
                                )
                              }
                              className="w-full text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] block transition-all cursor-pointer"
                            >
                              {qr.label}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 px-1 font-medium">
                    {m.sender} {m.fromPhone ? `· ${m.fromPhone}` : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 space-y-2">
          {activeChannel === "VENDOR_ADMIN_WA" && (
            <input
              type="url"
              placeholder="Optional attached image URL for new product photo..."
              value={attachedImage}
              onChange={(e) => setAttachedImage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:border-emerald-500"
            />
          )}
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder={
                activeChannel === "VENDOR_ADMIN_WA"
                  ? "Send command (#help, sales, stock, ship Lekki 3500)..."
                  : `Send message as ${currentBuyerName}...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={sending}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition-all"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
