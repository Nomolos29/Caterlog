"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import type { BuyerSession, ChatChannel, ChatMessage } from "@/lib/types";
import type { RunAction } from "./dashboard";

interface ChatPanelProps {
  messages: ChatMessage[];
  activeBuyerSession: BuyerSession | null;
  run: RunAction;
}

const VENDOR_CHIPS = [
  "sales",
  "pending",
  "shipping add Ikoyi 4000",
  "discount add FLASH 15%",
  "stock SHOE-01 12",
  "mode copilot 90s",
  "hold 20",
  "dashboard",
];

export function ChatPanel({ messages, activeBuyerSession, run }: ChatPanelProps) {
  const [activeChannel, setActiveChannel] = useState<ChatChannel>("VENDOR_ADMIN_WA");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => messages.filter((message) => message.channel === activeChannel),
    [messages, activeChannel]
  );
  const lastMessageId = filtered[filtered.length - 1]?.id;

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lastMessageId, activeChannel]);

  const sendVendor = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setSending(true);
    await run(
      async () =>
        (await api.simulateWhatsApp({ role: "VENDOR_KEYWORD", text: clean })).state
    );
    setSending(false);
  };

  const sendBuyer = async (text: string, quotedStatusImagePhash?: string) => {
    const clean = text.trim();
    if (!clean) return;
    setActiveChannel("BUYER_SHOP_WA");
    setSending(true);
    await run(
      async () =>
        (
          await api.simulateWhatsApp({
            role: "BUYER_INQUIRY",
            text: clean,
            quotedStatusImagePhash,
            simulateFastForwardIdleTimer: true,
          })
        ).state
    );
    setSending(false);
  };

  const sendVendorManualEcho = async () => {
    setActiveChannel("BUYER_SHOP_WA");
    setSending(true);
    await run(
      async () =>
        (
          await api.simulateWhatsApp({
            role: "VENDOR_MANUAL_BUYER_REPLY",
            text: "Hold on Chidinma, let me check the gold size 40 in the store!",
          })
        ).state
    );
    setSending(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (activeChannel === "VENDOR_ADMIN_WA") {
      await sendVendor(text);
    } else {
      await sendBuyer(text);
    }
  };

  const copyNuban = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
    } catch {
      // Clipboard access can be blocked; the number remains selectable.
    }
  };

  return (
    <aside className="lg:col-span-5 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden h-[760px]">
      <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            WhatsApp Live Threads
          </h2>
          <p className="text-[11px] text-gray-400 truncate">
            {activeBuyerSession
              ? `Awaiting zone: ${activeBuyerSession.buyerName} • qty ${activeBuyerSession.quantity}`
              : "Test Vendor Keywords or Buyer Checkout & watch the dashboard sync live"}
          </p>
        </div>
        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveChannel("VENDOR_ADMIN_WA")}
            className={
              activeChannel === "VENDOR_ADMIN_WA"
                ? "px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold"
                : "px-2.5 py-1 rounded-md text-gray-400 hover:text-white font-semibold"
            }
          >
            🛠️ Vendor CLI
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel("BUYER_SHOP_WA")}
            className={
              activeChannel === "BUYER_SHOP_WA"
                ? "px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold"
                : "px-2.5 py-1 rounded-md text-gray-400 hover:text-white font-semibold"
            }
          >
            🛍️ Buyer Thread
          </button>
        </div>
      </div>

      {activeChannel === "VENDOR_ADMIN_WA" ? (
        <div className="px-3 py-2 bg-gray-950/60 border-b border-gray-800 flex flex-wrap gap-1.5">
          {VENDOR_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => void sendVendor(chip)}
              className="text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-emerald-300 px-2 py-1 rounded"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 bg-gray-950/60 border-b border-gray-800 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={sending}
            onClick={() =>
              void sendBuyer("I want Hermes Slide (SHOE-02) delivered to Mainland")
            }
            className="text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sky-300 px-2 py-1 rounded"
          >
            Buy SHOE-02 (Mainland)
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() =>
              void sendBuyer(
                "How much is this bag on your Status? Deliver to Lekki with PAYDAY",
                "9988776655443322"
              )
            }
            className="text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-amber-300 px-2 py-1 rounded"
          >
            📸 Swipe Status Photo (BAG-01 + PAYDAY)
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void sendVendorManualEcho()}
            className="text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-rose-300 px-2 py-1 rounded"
          >
            ✋ Simulate Vendor Phone Reply (Cancel Co-Pilot)
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">
            No messages in this thread yet.
          </p>
        ) : (
          filtered.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              copied={copiedId === message.id}
              onCopy={() => void copyNuban(message)}
              onQuickReply={(reply) => void sendBuyer(reply)}
              disabled={sending}
            />
          ))
        )}
      </div>

      <form
        onSubmit={submit}
        className="p-3 bg-gray-950 border-t border-gray-800 flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            activeChannel === "VENDOR_ADMIN_WA"
              ? "Type a vendor keyword (e.g. shipping add Surulere 2500, sales, help)…"
              : "Type a buyer message (e.g. I want Zara Block Heel delivered to Lekki)…"
          }
          required
          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </aside>
  );
}

function MessageBubble({
  message,
  copied,
  onCopy,
  onQuickReply,
  disabled,
}: {
  message: ChatMessage;
  copied: boolean;
  onCopy: () => void;
  onQuickReply: (reply: string) => void;
  disabled: boolean;
}) {
  const isBot = message.sender === "CATERLOG_BOT";
  const isStandaloneNuban = isBot && /^\d{10}$/.test(message.text.trim());

  if (isStandaloneNuban) {
    return (
      <div className="flex flex-col items-start max-w-[85%] animate-fade-up">
        <div className="wa-bubble-nuban rounded-xl px-4 py-2.5 text-emerald-300 font-bold text-sm flex flex-wrap items-center gap-3">
          <span>{message.text}</span>
          <button
            type="button"
            onClick={onCopy}
            className="text-[11px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded font-sans"
          >
            {copied ? "Copied ✓" : "Copy 10-Digit NUBAN"}
          </button>
        </div>
        <span className="text-[10px] text-gray-500 mt-0.5">
          1-Tap Copy Bubble • Caterlog Bot
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${isBot ? "items-start" : "items-end ml-auto"} max-w-[88%] animate-fade-up`}
    >
      {message.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- chat images are vendor URLs.
        <img
          src={message.imageUrl}
          alt="Product shared in chat"
          className="h-28 w-28 rounded-lg object-cover border border-gray-800 mb-1"
        />
      ) : null}
      <div
        className={`${
          isBot ? "wa-bubble-bot text-gray-100" : "wa-bubble-user text-white"
        } rounded-xl px-3.5 py-2.5 text-xs leading-relaxed shadow whitespace-pre-wrap break-words`}
      >
        {renderWhatsAppText(message.text)}
      </div>

      {message.quickReplies && message.quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5 justify-end">
          {message.quickReplies.map((reply) => (
            <button
              key={`${message.id}-${reply.replyText}`}
              type="button"
              disabled={disabled}
              onClick={() => onQuickReply(reply.replyText)}
              className="text-[10px] bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-emerald-300 px-2 py-1 rounded border border-gray-700"
            >
              {reply.label}
            </button>
          ))}
        </div>
      ) : null}

      <span className="text-[10px] text-gray-500 mt-0.5">
        {senderLabel(message.sender)} • {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

function renderWhatsAppText(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <strong key={index}>{part.slice(1, -1)}</strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function senderLabel(sender: ChatMessage["sender"]): string {
  switch (sender) {
    case "CATERLOG_BOT":
      return "Caterlog Bot";
    case "VENDOR":
      return "Vendor";
    case "BUYER":
      return "Buyer";
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
