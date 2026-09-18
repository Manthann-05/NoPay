# NoPay — Offline-First Transaction & Billing System (PWA)

NoPay is a production-grade, genuine **Offline-First Progressive Web Application (PWA)** for retail billing, QR payments, and reliable server synchronization. It enables customers and merchants to conduct retail billing workflows even under **zero internet connectivity**, queueing transactions locally and auto-synchronizing idempotently once connectivity is restored.

---

## ⚠️ Product Boundary & Realism Notice

> **Important Boundary:** NoPay does **NOT** claim that real bank money or inter-bank settlements can be magically transferred without connectivity.
> 
> Instead, NoPay provides:
> 1. **Offline Bill Generation & Itemized Cart**: Merchants can create bills and calculate totals entirely on-device without internet.
> 2. **Offline-Capable QR Codes**: Static merchant and itemized bill QR codes contain self-contained payloads readable by any camera scanner offline.
> 3. **Cryptographic Idempotent Offline Queue**: Customer payment intents are saved to browser IndexedDB with unique UUID idempotency keys and timestamps.
> 4. **Deferred Auto-Sync**: When internet connectivity returns, transactions are sent in order to the central ledger with automatic retries, backoff, and duplicate rejection.

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
   - Implements a cache versioned strategy (`nopay-cache-v2`, `nopay-dynamic-v2`).
   - App shell navigation requests are served with a fast **Cache-First / Stale-While-Revalidate** strategy, with automatic fallback to `/` when offline.
   - Next.js static assets (`/_next/static/*`) and media files are cached on retrieval.
   - API endpoints (`/api/*`) bypass the service worker to prevent stale mutations.

2. **IndexedDB Schema via Dexie.js (`src/offline/db.ts`)**:
   - `localSession`: Caches user identity, roles, active role, and merchant profile offline (no tokens or passwords).
   - `transactions`: Local transaction ledger for both customer and merchant history.
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
| `CONFIRMED` / `SYNCED` | Successfully accepted and deduplicated by server MongoDB ledger. | Terminal State |
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

### Step 3: Perform Offline Billing & Scanning
1. Switch to **Merchant Mode** -> go to `/merchant/billing`:
   - Inventory catalog loads from local IndexedDB.
   - Add items to the cart or add custom items.
   - Click **Generate Bill QR Code**:
     - Bill QR is generated locally on device canvas.
2. In another window/tab (or same device):
   - Go to `/customer/scan` or enter `/customer/static-pay`:
   - Enter an amount (e.g. ₹250) and submit.
   - The transaction is recorded in IndexedDB with status `PENDING_SYNC` and queued in the sync engine.
   - Check `/customer/transactions`: notice the transaction appears marked as `OFFLINE QUEUED`.
   - The navigation badge updates to `1 Pending`.

### Step 4: Reconnect & Verify Automatic Synchronization
1. In DevTools **Network** tab, uncheck **Offline** (restore internet connectivity).
2. Observe:
   - Online status hook automatically detects the `online` event.
   - OfflineBadge changes to `Online` and triggers `processSyncQueue()`.
   - The pending count decreases to 0.
   - The transaction status transitions to `CONFIRMED`.
   - MongoDB receives the transaction with zero duplicates thanks to the unique `idempotencyKey`.

---

## 💻 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB (Atlas) + Dexie.js (Browser IndexedDB)
- **Offline Infrastructure**: Custom Service Worker, IndexedDB Sync Queue, Idempotent Transaction Pipeline
- **Styling**: Tailwind CSS
- **QR Engine**: `qrcode.react` (Generator) + `html5-qrcode` (Scanner)
- **Icons**: Lucide React
