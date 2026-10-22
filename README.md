# NoPay — Offline-First Transaction & Billing System (PWA)

NoPay is a production-grade, genuine **Offline-First Progressive Web Application (PWA)** for retail billing, QR payments, and reliable server synchronization. It enables customers and merchants to conduct retail billing workflows even under **zero internet connectivity**, queueing transactions locally and auto-synchronizing idempotently once connectivity is restored.

---

## ⚠️ Product Boundary & Realism Notice

> **Important Boundary:** NoPay does **NOT** claim that real bank money or inter-bank settlements can be magically transferred without connectivity.
> 
> Instead, NoPay provides:
> 1. **Offline Bill Generation & Itemized Cart**: Merchants can create bills and calculate totals entirely on-device without internet.
> 2. **Offline-Capable NoPay QR Codes**: Static merchant and itemized bill QR codes contain self-contained payloads readable by the NoPay scanner offline. Merchant IDs and QR-provided names are shown for identification, but cannot be server-verified while offline. In-app scanning accepts only versioned NoPay QR payloads; external bank/UPI QR codes are rejected.
> 3. **Offline Transaction Records**: Customer payment intents are saved to browser IndexedDB with unique UUID idempotency keys and timestamps. They sync to the NoPay ledger after the customer reconnects; a merchant cannot see a customer's local record while both devices are offline.
> 4. **Deferred Auto-Sync**: When internet connectivity returns, transactions are sent in order to the central ledger with automatic retries, backoff, and duplicate rejection.
>
> An offline transaction record is stored on the customer device until it can sync; it is not proof that cash or bank funds were transferred. NoPay does not verify or settle offline payments.
>
> **Optional AutoPay recovery:** When enabled and available on the NoPay Razorpay account, a customer may authorize a separate UPI mandate for a specific merchant with a maximum debit amount. After an eligible, server-stored merchant bill is matched to that customer, NoPay can request a debit with Razorpay's required pre-debit notice (typically at least 24 hours). Syncing an offline record alone never proves payment or authorizes a debit. A captured payment and its merchant transfer have separate states; a captured debit does not mean the merchant's bank settlement is complete.

### AutoPay and merchant payout prerequisites

AutoPay is disabled unless both `RAZORPAY_AUTOPAY_ENABLED` and `RAZORPAY_ROUTE_ENABLED` are set to `true`. Razorpay must enable UPI recurring payments and Route for the NoPay account, and the merchant must finish Route onboarding and verification. Eligibility and activation depend on Razorpay account approval; the feature is not a substitute for offline payment verification.

For each eligible bill, the customer must explicitly select **Pay when online** at offline checkout. After sync, NoPay revalidates the merchant-issued bill, customer, active merchant-specific mandate, amount, and spending cap before requesting a debit. The debit is not immediate on sync: the customer receives the provider's pre-debit notice before the scheduled collection. A bill is marked paid only after the server verifies a captured Razorpay payment through checkout verification or a signed capture webhook. NoPay then creates an idempotent Route direct transfer for the bill's full amount. This makes NoPay responsible for provider fees and requires sufficient available NoPay account balance to fund both payouts and applicable fees; a payout can remain pending or fail even after the customer debit is captured. Customers can revoke a mandate. Static-QR records never trigger AutoPay; after the customer record syncs, the customer must review the merchant and amount and complete an online checkout. A synced record is not itself proof of payment.

Set `RAZORPAY_WEBHOOK_SECRET` to the secret configured for the Razorpay webhook endpoint `/api/payments/webhook`. Subscribe it to the payment, token, transfer, and Route account events handled by the endpoint. Keep both feature flags off until the provider features, webhook configuration, and merchant payout flow have been tested with the Razorpay account.

### Merchant shop verification documents

Merchants can submit their legal business name, business structure, GSTIN, address, and supporting PDFs/JPEGs/PNGs from **Profile → Shop verification**. Files are limited to 10 MB and stored in MongoDB GridFS using the existing `MONGODB_URI`; no separate storage account or credentials are required. MongoDB stores document bytes in its `merchantVerificationDocuments.files` and `merchantVerificationDocuments.chunks` collections, while the merchant profile stores document metadata and a private file reference. Documents are only downloadable through the authenticated merchant account. Ensure the MongoDB deployment has enough storage capacity and restrict database access to the application. For this web setup, submitting at least one document enables NoPay QR transaction records without a separate payout-account onboarding step. This is not independent business/KYC verification and does not process or confirm real payments.

The document list covers common business proof categories (GST registration, PAN, shop/trade licence, address proof, business registration, and owner/authorised representative ID), but actual requirements vary. This web setup enables NoPay QR records when a document is submitted; no in-app reviewer/admin workflow is implemented.

---

## 🏗️ Architecture Overview

```
                   +---------------------------------------+
                   |           NoPay Web App (PWA)         |
                   +---------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+------------------+                                      +------------------+
|  Service Worker  |                                      | Dexie.js (IDB)   |
|  Cache Storage   |                                      | Local Database   |
+------------------+                                      +------------------+
| - App Shell      |                                      | - localSession   |
| - Precached HTML |                                      | - syncQueue      |
| - Static Assets  |                                      | - transactions   |
| - JS/CSS Chunks  |                                      | - products       |
| - Fallback Shell |                                      | - bills          |
+------------------+                                      +------------------+
         |                                                         |
         | (Offline: Serves Cache / IDB)                           |
         v                                                         v
+------------------+                                      +------------------+
| Dynamic UI Shell | <==================================> | Sync Engine      |
| (Client Session) |      (Offline Transaction Queue)     | (Backoff/Retry)  |
+------------------+                                      +------------------+
                                                                   |
                                                      (Online Sync Event)
                                                                   v
                                                          +------------------+
                                                          |  Next.js API &   |
                                                          |  MongoDB Atlas   |
                                                          +------------------+
```

### Core Offline Components

1. **Service Worker (`public/sw.js`)**:
   - Implements a cache versioned strategy (`nopay-cache-v4`, `nopay-dynamic-v4`).
   - App shell navigation requests are served with a fast **Cache-First / Stale-While-Revalidate** strategy, with automatic fallback to `/` when offline.
   - Next.js static assets (`/_next/static/*`) and media files are cached on retrieval; authenticated route caching also follows referenced lazy chunks needed for offline checkout.
   - API endpoints (`/api/*`) bypass the service worker to prevent stale mutations.

2. **IndexedDB Schema via Dexie.js (`src/offline/db.ts`)**:
   - `localSession`: Caches user identity, roles, active role, and merchant profile offline (no tokens or passwords).
   - `transactions`: Local transaction records. Each device keeps its own copy; a customer's offline record syncs after that customer reconnects.
   - `syncQueue`: Offline sync queue storing items with state (`PENDING_SYNC`, `RETRY_PENDING`, `SYNCED`, `REJECTED`), attempt counts, backoff timings, and idempotency keys.
   - `bills`: Local store for itemized bills generated offline by the merchant.
   - `products`: Cached product catalog for offline POS search, stock display, and barcode lookups.

3. **Event-Driven Online Status (`src/hooks/useOnlineStatus.ts`)**:
   - Eliminates polling to save client battery and cellular bandwidth.
   - Listens to browser `online` and `offline` events.
   - Transitions through `ONLINE`, `OFFLINE`, `CONNECTING`, and `SYNCING` states.

4. **Sync Engine with Exponential Backoff (`src/offline/sync.ts`)**:
   - Distinguishes network failures (transitions to `RETRY_PENDING` with 0s, 2s, 5s, 15s, 30s backoff) from server-side rejections (`REJECTED`).
   - Caps retries at 5 attempts before flagging for merchant review.
   - Automatically triggers synchronization on reconnection.

5. **Client-Driven App Shell (`src/app/layout.tsx` & `Navbar.tsx`)**:
   - Removed blocking server-side MongoDB connection from the root layout.
   - Layout is a lightweight static shell that renders immediately offline.
   - User identity loads progressively from IndexedDB when offline and reconciles with `/api/auth/me` when online.

---

## 🔄 Transaction Lifecycle States

| State | Description | Next Possible State |
|---|---|---|
| `PENDING_SYNC` | Created offline or queued locally; waiting for initial sync attempt. | `SYNCING`, `RETRY_PENDING`, `CONFIRMED` |
| `RETRY_PENDING` | Network failure during sync; scheduled for retry using exponential backoff. | `SYNCING`, `CONFIRMED`, `REJECTED` |
| `CONFIRMED` / `SYNCED` | Successfully accepted and deduplicated by server MongoDB ledger; this is not proof of money transfer. | Terminal State |
| `REJECTED` | Permanently rejected by server (e.g. invalid bill data, 4xx error). | Terminal State |

---

## 📱 Offline Capabilities Matrix

| Workflow | Offline (Zero Internet) | Online |
|---|:---:|:---:|
| Open App & Navigation | ✅ Cached App Shell | ✅ Full Network |
| Login / Register | ⚠️ Requires initial online auth | ✅ Full Auth |
| Persist Session | ✅ IndexedDB `localSession` | ✅ JWT Cookie + Session |
| Switch Active Role (Customer/Merchant) | ✅ Local Dexie Update | ✅ Server Synced |
| Browse Inventory Catalog | ✅ IndexedDB Cached Catalog | ✅ Real-time DB |
| Barcode & Item Search | ✅ Local Search | ✅ Server Search |
| Create POS Bill & Calculate Totals | ✅ 100% Offline | ✅ Online & Cached |
| Generate Itemized Bill QR | ✅ Local QR Generation | ✅ Online & Saved |
| Display Static Merchant QR | ✅ Local QR Generation | ✅ Online & Cached |
| Camera QR Scanner | ✅ Local Canvas & Video API | ✅ Supported |
| Record Payment Intent | ✅ Queued in IndexedDB | ✅ Direct API Sync |
| Copy Pending Record to Merchant Device | ✅ Customer displays QR; merchant scans and saves locally | ✅ Same QR handoff is available |
| View Past Transactions | ✅ IndexedDB History | ✅ Merged DB History |
| Auto-Sync Queue | ⏸️ Paused (Safe in Dexie) | ⚡ Auto-Sync Triggered |

---

## 🧪 Testing Zero-Connectivity in DevTools

To test and verify the genuine offline experience:

### Step 1: Initial Online Boot & Service Worker Registration
1. Run the application:
   ```bash
   npm run build
   npm start
   # Or in development mode:
   npm run dev
   ```
2. Open Chrome/Edge at `http://localhost:3000`.
3. Log in with an existing account or register a new customer/merchant account.
4. Navigate through:
   - `/customer/dashboard`
   - `/customer/scan`
   - `/merchant/dashboard`
   - `/merchant/billing`
   - `/merchant/static-qr`
5. Open **DevTools** (`F12`) -> **Application** -> **Service Workers**:
   - Verify `sw.js` is registered, active, and running.
   - Verify **Cache Storage** contains `nopay-cache-v2`.
   - Verify **IndexedDB** -> `NoPayOfflineDB` contains your session in `localSession` and products in `products`.

### Step 2: Go Completely Offline
1. In Chrome DevTools, open the **Network** tab.
2. Check the **Offline** checkbox (or select "Offline" in the throttling dropdown).
3. Observe the top navigation badge switch to `Offline Mode` (amber pill).
4. Refresh the page (`Ctrl + R` or `F5`):
   - **The app loads instantly without any network connection.**
   - Notice the layout renders, user identity remains intact from IndexedDB, and navigation works.

### Step 3: Create an Offline Customer Record
1. Switch to **Merchant Mode** -> go to `/merchant/billing`:
   - Inventory catalog loads from local IndexedDB.
   - Add items to the cart or add custom items.
   - Click **Generate Bill QR Code**:
     - Bill QR is generated locally on device canvas.
2. In another window/tab (or same device):
   - Go to `/customer/scan` or enter `/customer/static-pay`:
   - Enter an amount (e.g. ₹250) and submit. The transaction is recorded in customer IndexedDB with status `PENDING_SYNC`.
   - The customer record is stored locally as `PENDING_SYNC`. It is not visible on the merchant's device while both devices are offline and is not proof of payment.
   - Check `/customer/transactions` for the pending record. After reconnecting, it syncs to the NoPay ledger.

### Step 4: Reconnect & Verify Automatic Synchronization
1. In DevTools **Network** tab, uncheck **Offline** (restore internet connectivity).
2. Observe:
   - Online status hook automatically detects the `online` event.
   - OfflineBadge changes to `Online` and triggers `processSyncQueue()`.
   - The pending count decreases to 0 on the device that queued the transaction.
   - MongoDB records the transaction with zero duplicates thanks to the unique `idempotencyKey`.
   - `CONFIRMED` means recorded in NoPay's server ledger, not confirmed payment settlement.

---

## 💻 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB (Atlas) + Dexie.js (Browser IndexedDB)
- **Offline Infrastructure**: Custom Service Worker, IndexedDB Sync Queue, Idempotent Transaction Pipeline
- **Styling**: Tailwind CSS
- **QR Engine**: `qrcode.react` (Generator) + `html5-qrcode` (Scanner)
- **Icons**: Lucide React
