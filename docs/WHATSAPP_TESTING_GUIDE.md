# Caterlog (Duka) — Live WhatsApp & Monnify Testing Guide

This guide explains how to test Caterlog in two modes:
1. **Mode 1: Local Sandbox Simulator Mode (`WHATSAPP_SANDBOX_MOCK="true"` & `MONNIFY_SANDBOX_MOCK="true"`)** — Zero external API keys required; test everything from your browser & terminal.
2. **Mode 2: Physical WhatsApp Phone Testing (`WHATSAPP_SANDBOX_MOCK="false"`)** — Connect your real Nigerian WhatsApp number (`+234...`) to your local Caterlog server in 5 minutes using Meta's free Cloud API Test Number.

---

## Mode 1: Local Sandbox Simulator (Zero API Keys Required)

By default, `.env.example` sets:
```env
WHATSAPP_SANDBOX_MOCK="true"
MONNIFY_SANDBOX_MOCK="true"
```
In this mode:
- You can send simulated WhatsApp Vendor Keyword messages (`shipping add Lekki 3500`, `discount add PAYDAY 10%`, `stock SHOE-01 12`, `sales`, `mode copilot 60s`, `hold 20`, `dashboard`) and Buyer product inquiries directly from the **Vendor Command Dashboard (`http://localhost:3000`)** or via `POST http://localhost:4000/api/v1/simulate/whatsapp`.
- Every change made via a WhatsApp keyword immediately synchronizes with the **Vendor Dashboard**, and vice versa.
- You can click **Simulate Monnify Transfer** (Full, Partial, or Overpayment) to fire a real `HMAC-SHA512`-signed webhook to `POST /webhooks/monnify`, triggering server-to-server verification and posting the `✅ PAID` receipt into the WhatsApp thread.

---

## Mode 2: Testing on Your Physical WhatsApp Phone (Meta Free Test Number)

To test directly from the **WhatsApp app on your phone** while `apps/api` runs on your laptop (`localhost:4000`):

### Step 1: Expose `localhost:4000` via a Free HTTPS Tunnel
Meta's servers require a public `https://` URL to deliver inbound webhooks (`POST /webhooks/whatsapp`). Run either Cloudflare Tunnel or ngrok in a terminal:

```bash
npx cloudflared tunnel --url http://localhost:4000
# OR
ngrok http 4000
```
Copy the generated HTTPS URL (e.g., `https://random-words.trycloudflare.com`).

### Step 2: Create a Free Meta Developer App & Get Your Test Number (3 Mins, ₦0 Cost)
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → Click **Create App** → Select **Other** → Select **Business**.
2. On the App Dashboard, find **WhatsApp** and click **Set up**.
3. In the left sidebar, open **WhatsApp → API Setup**. Meta provides a free Test WhatsApp number along with:
   - **Temporary access token** → Copy into `.env` as `WHATSAPP_ACCESS_TOKEN="..."`
   - **Phone number ID** → Copy into `.env` as `WHATSAPP_PHONE_NUMBER_ID="..."`
4. Still on **API Setup**, under **"To" (Step 1)**, click **Manage phone number list** and add **your personal WhatsApp number (`+234...`)**. Enter the 6-digit confirmation code Meta sends to your WhatsApp.
5. In the left sidebar, open **App Settings → Basic** and copy your **App Secret** → Paste into `.env` as `WHATSAPP_APP_SECRET="..."`.

### Step 3: Register Your Webhook URL in Meta
1. In the left sidebar, open **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL:** `https://<your-tunnel-url>/webhooks/whatsapp`
   - **Verify token:** `caterlog-whatsapp-verify-token` (must match `WHATSAPP_VERIFY_TOKEN` in `.env`)
3. Click **Verify and save**.
4. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` (inbound buyer/vendor messages and Status replies)
   - `message_echoes` (detects when the vendor replies from their mobile phone so Smart Co-Pilot cancels its 60s idle timer)
5. In your `.env` file, set:
   ```env
   WHATSAPP_SANDBOX_MOCK="false"
   ```
   and restart `apps/api`.

### Step 4: Test Live from Your Phone's WhatsApp
Open WhatsApp on your phone and send messages to the **Meta Test Number**:

#### A. Test Dual-Access Vendor Keywords (When your phone number matches `vendor.whatsappPhone`)
- **Check Revenue Breakdown:** Send `sales` or `sales week`
- **Add/Update Shipping Zone:** Send `shipping add Lekki 3500` → Check your Web Dashboard (`localhost:3000`) and watch *Lekki (₦3,500)* appear live!
- **Create a Promo Code:** Send `discount add PAYDAY 10%`
- **Update Product Stock:** Send `stock SHOE-01 15`
- **Add a New Product via Chat:** Send `Balenciaga Mule, 32000, stock 4`
- **Change Co-Pilot Mode/Timer:** Send `mode copilot 90s` or `mode auto`
- **Change Stock Reservation Hold Window:** Send `hold 20`
- **Get 1-Tap Web Dashboard Login Link:** Send `dashboard`

#### B. Test Buyer Checkout & 1-Tap Copyable NUBAN
- Send `buy SHOE-01 Lekki` (or `"I want Zara Block Heel"`):
  1. Caterlog locks 1 unit of stock for `15 minutes` (or your configured `hold` window).
  2. Caterlog sends the **Formatted Invoice Bubble** (showing item, shipping fee, total `₦28,500`, and Verified Seller badge).
  3. Immediately after, Caterlog sends a second bubble containing **only** the 10-digit NUBAN (`8092341102`) so you can long-press and copy it in 1 tap on your phone.

---

## Mode 3: Connecting Monnify Sandbox / Live Keys (Optional)

When you want to generate real Monnify virtual accounts instead of simulated ones:
1. Log in to [app.monnify.com](https://app.monnify.com) (toggle **Test Mode** in the top bar for Sandbox).
2. Go to **Settings → API Keys & Webhooks** and copy:
   - `MONNIFY_API_KEY`
   - `MONNIFY_SECRET_KEY`
   - `MONNIFY_CONTRACT_CODE`
3. Set the Monnify Webhook URL to:
   - `https://<your-tunnel-url>/webhooks/monnify`
4. Set `MONNIFY_SANDBOX_MOCK="false"` in `.env`.

