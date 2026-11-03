import React, { useState } from "react";
import type { ChatMessageItem } from "@/lib/types";
import { CloseIcon, WhatsAppBadgeIcon } from "./icons";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessageItem[];
  onSendVendorKeyword: (text: string, attachedImage?: string) => Promise<void>;
  onSendBuyerInquiry: (text: string, phash?: string) => Promise<void>;
  onSendVendorManualEcho: (text: string) => Promise<void>;
}

export function ChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  onSendVendorKeyword,
  onSendBuyerInquiry,
  onSendVendorManualEcho,
}: ChatDrawerProps) {
  const [activeChannel, setActiveChannel] = useState<"VENDOR_ADMIN_WA" | "BUYER_SHOP_WA">("BUYER_SHOP_WA");
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState("");
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const filteredMessages = chatMessages.filter((m) => m.channel === activeChannel);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setSending(true);
    try {
      if (activeChannel === "VENDOR_ADMIN_WA") {
        await onSendVendorKeyword(inputText.trim(), attachedImage.trim() || undefined);
      } else {
        await onSendBuyerInquiry(inputText.trim());
      }
      setInputText("");
      setAttachedImage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col justify-between">
      {/* Drawer Header */}
      <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <WhatsAppBadgeIcon className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>WhatsApp Live Coexistence Engine</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[10px] text-gray-400">Test live keywords, status replies &amp; bot handoffs</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white">
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Channel Switcher */}
      <div className="p-2 bg-gray-50 border-b border-gray-100 flex gap-2">
        <button
          onClick={() => setActiveChannel("BUYER_SHOP_WA")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeChannel === "BUYER_SHOP_WA"
              ? "bg-white text-emerald-700 shadow-xs border border-gray-200"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          🛍️ Buyer Thread
        </button>
        <button
          onClick={() => setActiveChannel("VENDOR_ADMIN_WA")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeChannel === "VENDOR_ADMIN_WA"
              ? "bg-white text-emerald-700 shadow-xs border border-gray-200"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          🛠️ Vendor CLI Chat
        </button>
      </div>

      {/* Preset Action Chips */}
      <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-1 text-[11px]">
        {activeChannel === "BUYER_SHOP_WA" ? (
          <>
            <button
              onClick={() => onSendBuyerInquiry("I want Zara Block Heel (SHOE-01)")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50"
            >
              Order without zone (Triggers prompt)
            </button>
            <button
              onClick={() => onSendBuyerInquiry("Lekki PAYDAY")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50"
            >
              Select Lekki + PAYDAY
            </button>
            <button
              onClick={() => onSendVendorManualEcho("Hold on Chidinma, let me check the store!")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-amber-700 hover:bg-amber-50"
            >
              Simulate Vendor Phone Reply (Cancel Co-Pilot)
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSendVendorKeyword("products")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono"
            >
              products
            </button>
            <button
              onClick={() => onSendVendorKeyword("ship Ibadan #6000")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono"
            >
              ship Ibadan #6000
            </button>
            <button
              onClick={() => onSendVendorKeyword("sales week")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono"
            >
              sales week
            </button>
            <button
              onClick={() => onSendVendorKeyword("hold 20")}
              className="px-2 py-1 bg-white border border-gray-200 rounded text-emerald-700 hover:bg-emerald-50 font-mono"
            >
              hold 20
            </button>
          </>
        )}
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {filteredMessages.map((m) => {
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
                  <img src={m.imageUrl} alt="Attachment" className="w-full max-h-40 object-cover rounded-xl mb-2" />
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Interactive Tappable Quick Reply Options */}
                {m.quickReplies && m.quickReplies.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
                    {m.quickReplies.map((qr: { label: string; replyText: string }, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => onSendBuyerInquiry(qr.replyText)}
                        className="w-full text-left bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] block transition-all"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5 px-1 font-medium">{m.sender}</span>
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 space-y-2">
        {activeChannel === "VENDOR_ADMIN_WA" && (
          <input
            type="url"
            placeholder="Optional attached image URL for new product photo..."
            value={attachedImage}
            onChange={(e) => setAttachedImage(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] text-gray-900"
          />
        )}
        <div className="flex gap-2">
          <input
            type="text"
            required
            placeholder={
              activeChannel === "VENDOR_ADMIN_WA"
                ? "Send keyword (e.g. ship Ibadan #6000, products, sales)..."
                : "Send buyer message (e.g. I want SHOE-01 or Lekki)..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
