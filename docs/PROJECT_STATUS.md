# Shopkeeper Mobile App — Project Status

> Live progress tracker. Updated after every phase completion.
> Phase structure follows `docs/gap-analysis.md` (37 gaps across 6 phases).

---

## Overall Progress

| Phase | Focus Area | Status | Progress |
|-------|-----------|--------|----------|
| Phase 1 | Foundation — Critical UX & Core Features (Gaps 1–5) | ✅ Complete | ██████████ 100% |
| Phase 2 | New Screens — Backend Exists, App Missing (Gaps 6–11) | ✅ Complete | ██████████ 100% |
| Phase 3 | Feature Completeness — Existing Screens (Gaps 12–25) | ✅ Complete | ██████████ 100% |
| Phase 4 | Design Migration — Retrofit to MD3 Paper (Gaps 26–32) | 🔵 In Progress | ████████░░ 85% |
| Phase 5 | Niche Backend-Linked Features (Gaps 33–34) | 🔵 In Progress | █████░░░░░ 50% (GAP-34 done, GAP-33 surveyed/not built) |
| Phase 6 | Ongoing — Verification & Maintenance (Gaps 35–37) | 🔄 Continuous | ░░░░░░░░░░ — |

**Module Coverage:** 36 / 36 routes have screen files (100%) | **TypeScript:** passing clean (`npx tsc --noEmit`)

---

## Phase 1: Foundation — Critical UX & Core Features (Gaps 1–5)
**Status:** ✅ Complete

| Gap | Description | Resolution |
|-----|-------------|------------|
| GAP-1 | Pull-to-refresh on 19 screens | ✅ Added `RefreshControl` to 15+ data-driven screens |
| GAP-2 | No error feedback to users | ✅ Replaced 31 silent `catch {}` blocks with `Alert`/`Snackbar` |
| GAP-3 | No pagination / infinite scroll | ✅ Added `onEndReached` to activity-log, recycle-bin, unified-ledger |
| GAP-4 | Missing `useBottomInset()` on 9 screens | ✅ Added `useBottomInset()` to 9 screens |
| GAP-5 | No date picker anywhere | ✅ Built reusable `src/components/DatePickerModal.tsx` |

---

## Phase 2: New Screens — Backend Exists, App Missing (Gaps 6–11)
**Status:** ✅ Complete

| Gap | Screen | Route | Status |
|-----|--------|-------|--------|
| GAP-6 | Notification Inbox | `/notifications` | ✅ Built & registered |
| GAP-7 | Outlet Management | `/outlets` | ✅ Built & registered |
| GAP-8 | Overdue Payment Reminders | `/reminders` | ✅ Built & registered |
| GAP-9 | Brand Management | `/brands` | ✅ Built & registered |
| GAP-10 | Counter Management | `/counters` | ✅ Built & registered |
| GAP-11 | Tax Rate Management | `/tax-rates` | ✅ Built & registered |

---

## Phase 3: Feature Completeness — Existing Screens (Gaps 12–25)
**Status:** ✅ Complete

| Gap | Description | Screen | Status |
|-----|-------------|--------|--------|
| GAP-12 | Invoice history missing actions (print/share/PDF/void/return/send) | `invoice-history.tsx` | ✅ Done |
| GAP-13 | B2B/Purchase tabs not pressable (no detail view) | `invoice-history.tsx` | ✅ Done |
| GAP-14 | Recurring invoice: multi-product, edit, date picker | `recurring-invoices.tsx` | ✅ Done |
| GAP-15 | Sales order → Convert to Invoice | `sales-orders.tsx` | ✅ Done |
| GAP-16 | No purchase detail view | `purchase-history.tsx` | ✅ Done (detail modal + return from there) |
| GAP-17 | Challan creation gaps (scanner, item edit, debounced search) | `challans.tsx` | ✅ Done (debounced search, product cart; scanner placeholder) |
| GAP-18 | Staff cannot self-mark attendance | `attendance.tsx` | ✅ Done (self check-in card shown to all roles) |
| GAP-19 | Attendance dead imports + error snackbars | `attendance.tsx` | ✅ Done (removed Portal/Dialog/Menu/List) |
| GAP-20 | Payroll dead imports + dark mode + confirm | `payroll.tsx` | ✅ Done (removed SegmentedButtons/List, process confirm) |
| GAP-21 | Leaves missing user picker | `leaves.tsx` | ✅ Done (employee search picker) |
| GAP-22 | Holiday delete no confirmation | `holidays.tsx` | ✅ Done (confirm dialog + Snackbar rendering) |
| GAP-23 | Shop hours missing time picker/validation | `shop-hours.tsx` | ✅ Done (HH:MM regex + range check) |
| GAP-24 | No search/filter on key lists | invoice-history, sales-orders, activity-log, recycle-bin | ✅ Done (Searchbar + filter chips) |
| GAP-25 | Export to PDF missing | All | ✅ Done (`src/lib/pdfExport.ts` + Export buttons on 4 screens) |

---

## Phase 4: Design Migration — Retrofit ~40 Screens to MD3 Paper (Gaps 26–32)
**Status:** 🔵 In Progress (85% — GAP-32 deliberately deferred, see below)

| Gap | Description | Severity | Status |
|-----|-------------|----------|--------|
| GAP-26 | Hardcoded `#0368FE` everywhere (~150+ occ. / ~40 screens) | Design | ✅ Done (all screens + shared components; only intentional semantic maps/print-doc/map-pin colors left as literals) |
| GAP-27 | Dark mode broken on 5 screens (payment-history, pnl-report, aging-report, support-tickets, reorder-suggestions) | Design | ✅ Done |
| GAP-28 | No `useTheme()` in ~40 screens | Design | ✅ Done (all screens + `Button`/`ToggleSwitch`/`BulkUploadCard`/`PosDashboardPanel` shared components) |
| GAP-29 | Dead imports in 5 screens (attendance✅, payroll✅, leaves✅, holidays✅, support-tickets✅) | Design | ✅ Done (5/5) |
| GAP-30 | Inconsistent safe area patterns | Design | ✅ Done (all straightforward top/bottom-only usages converted to `useTopInset`/`useBottomInset`; a few files with custom insets math — e.g. `(tabs)/_layout.tsx`'s tab-bar height — deliberately left on raw `useSafeAreaInsets()`) |
| GAP-31 | Type `any` in data states (pnl-report✅, balance-sheet✅, aging-report✅) | Design | ✅ Done |
| GAP-32 | No Paper `SegmentedButtons`/`Searchbar`/`Card` on old screens | Design | ⬜ **Deliberately deferred** — see note below |

**Approach:** Standardize old-system screens on `useTheme()` + `theme.colors.primary`, replace hardcoded `#0368FE`/`#333`/`#666` with theme tokens, add `dark:` Tailwind classes for dark mode, convert raw RN toggles/inputs to Paper equivalents.

**2026-07-22 session — Phase 4 substantially complete:**
- **GAP-29 finished**: removed the last dead import (`useSafeAreaInsets`, unused, in `support-tickets.tsx`).
- **GAP-27 fully resolved** (5 screens: `payment-history.tsx`, `pnl-report.tsx`, `aging-report.tsx`, `reorder-suggestions.tsx`, `support-tickets.tsx`). Root cause confirmed beyond the gap doc's description: these screens used `text-text-primary`/`text-text-secondary`/`bg-surface` NativeWind classes that **don't resolve at all** — `tailwind.config.js` has no `text-primary`/`text-secondary` color keys — so text silently rendered with no color applied. Fixed via the established convention (`text-on-surface dark:text-text-primary-dark`, `text-on-surface-variant dark:text-text-secondary-dark`, `bg-surface-container-lowest dark:bg-surface-dark`, `border-outline-variant dark:border-outline`), plus `useTheme()` for icon/spinner colors and `text-success`/`text-error` for amount coloring.
- **GAP-31 fully resolved**: real interfaces replacing `any` in `pnl-report.tsx` (`PnlData`), `aging-report.tsx` (`AgingData`/`AgingEntry`), `balance-sheet.tsx` (`BalanceSheetData`/`StockValuationData`/`StockValuationRow`/`TrialBalanceData`/`TrialBalanceGroup`/`TrialBalanceAccount`).
- **GAP-26/28/30 — completed the remaining 47 screen files** via 6 parallel batches (5 background agents each given the exact conversion table + explicit DO-NOT-TOUCH list for semantic color maps and business logic, 1 handled directly) plus the 4 largest/highest-risk screens (`(tabs)/pos.tsx` 2,619 lines, `more.tsx` 4,135 lines, `(tabs)/inventory.tsx` 1,873 lines, `(tabs)/ledger.tsx` 1,264 lines) done directly with extra care given they're revenue-critical flows. Also fixed the same pattern in 4 shared components reused across dozens of screens: `Button.tsx`, `ToggleSwitch.tsx`, `BulkUploadCard.tsx`, `PosDashboardPanel.tsx`.
- **Real, previously-undetected bug found and fixed during this pass**: `more.tsx`, `(tabs)/pos.tsx`, and `(tabs)/inventory.tsx` had **260 bare `text-text-primary`/`text-text-secondary`** occurrences (same dead-class bug as GAP-27, just not caught by the original 5-screen list) — some already paired with a correct `dark:text-text-primary-dark` counterpart (just needed the light-mode half fixed), others missing the dark pairing entirely. Fixed with a dark-pair-aware script (swap-in-place where a correct pair already existed, inject the full pair where it didn't) rather than a blind find-replace, to avoid corrupting the ones that were already right.
- **Important discovery, not yet acted on**: `app/_layout.tsx` calls `colorScheme.set("light")` on boot, forcing NativeWind to **always render light-mode classes app-wide regardless of system theme** — a comment there explains this was a deliberate stopgap specifically *because* dark-mode coverage across old screens was incomplete (i.e., this Phase 4 work is the exact prerequisite for lifting it). **Left the lock in place** — flipping it is a real production behavior change affecting every user immediately and deserves on-device verification first, not a blind flip at the end of a mechanical pass. Flagged as the natural next step once someone can QA it on a device.
- **Incident during batch work, resolved**: one background agent (batch C) ran `git checkout --` on `bank-accounts.tsx` mid-task, briefly discarding an unrelated pre-existing uncommitted `RefreshControl`/`refreshing` feature. It self-caught this, reconstructed the feature from its own earlier file read, and flagged it. Verified directly via `git diff` — the reconstruction is complete and correct (import, state, callback, and `FlatList` wiring all present), no data lost. (Separately confirmed a pre-existing stash dated 2026-07-10 in this repo predates this session by 10 days and is unrelated.)
- **GAP-32 deliberately deferred**: converting raw `Pressable`/`TextInput`/`View` to Paper's `SegmentedButtons`/`Searchbar`/`Card` is a structural component swap (changes real touch targets, ripple/elevation behavior, not just colors) — the gap doc's own estimate is ~8 days for this alone. Every other gap in this phase was a zero-behavior-risk token/type substitution verified by `tsc`; GAP-32 is not, and doing it blind across ~40 screens without on-device visual QA risks real regressions in a live production app. Recommend tackling this as its own scoped pass with device testing, not bundled into this one.
- Verified: `npx tsc --noEmit` clean after every single file change in this session (agents and direct edits both).

---

## Phase 5: Niche Backend-Linked Features (Gaps 33–34)
**Status:** 🔵 In Progress

| Gap | Description | Status |
|-----|-------------|--------|
| GAP-33 | Low-value endpoints not surfaced (`/product-attributes`, `/batches`, `/tds-deductions`, `/product-serials`, `/compliance`, `/credit-history`) | 🟡 Survey done, 0/6 screens built — see below for exact next steps |
| GAP-34 | No GST return line items drill-down on screen | ✅ Done |

**2026-07-22 session:**

**GAP-34 — done.** `app/gst-reports.tsx`'s "GST Return Data" tab previously only showed counts ("B2B Sales (12)", "B2C Sales (34)", "Purchases (8)") with the actual line items visible only via CSV export. Added three collapsible `GstDrillDownSection` components (one per B2B/B2C/Purchases) with chevron expand/collapse state (`expandedGstSection`), each rendering the real rows on-screen (invoice/purchase number, date, party/supplier name, GSTIN, taxable value, CGST/SGST or IGST split, grand total) via new `GstSaleRowCard`/`GstPurchaseRowCard` components — same visual pattern as the existing Day Book detail lists further down the same file, for consistency. CSV export button unchanged. Verified `tsc` clean.

**GAP-33 — user explicitly chose "build all 6 minimal screens now" (not conditional on demand, overriding the gap doc's own "only if user demand exists" framing).** Ran a full backend survey (endpoints, request/response shapes, Prisma models, access control) before writing any UI — confirmed via `grep` that **none of the 6 have any existing mobile UI reference today**. Full findings below so the next agent doesn't need to re-derive them:

### 1. Product Attributes
- Route: `shopkeeper-api/src/routes/productAttributes.ts`, mounted at **`/settings/product-attributes`** (not `/product-attributes` — note the prefix)
- `GET /` → `{data: ProductAttribute[]}` — any authenticated role
- `POST /` → body `{key, label, dataType: text|number|decimal|boolean|singleSelect|dimension|weight, unitOptions?, choices?, validation?, groupName?, displayOrder?, isInvoicePrintable?}` → 201 `{data}`; 409 if `key` already exists — **owner/manager/warehouse_manager**
- `PATCH /:id` — same body minus `key`, partial — **owner/manager/warehouse_manager**
- `DELETE /:id` → `{success, deletedValueCount}` (cascades `ProductAttributeValue`) — **owner/manager/warehouse_manager**
- Prisma: `ProductAttribute` (companyId, key, label, dataType, unitOptions String[], choices String[], validation Json?, groupName?, displayOrder, isInvoicePrintable), `ProductAttributeValue` (productId, productAttributeId, valueText/valueNumber/valueJson)
- Suggested screen: `app/product-attributes.tsx` — flat list + add/edit modal (key, label, dataType picker, choices as comma-separated input when `dataType` is `singleSelect`, group name, display order, `isInvoicePrintable` toggle), delete with confirm.

### 2. Batches
- Route: `shopkeeper-api/src/routes/batches.ts`, mounted at `/batches`
- `GET /` — query `productId?`, `page?`, `limit?` → `{data: [{id, batchNumber, expiryDate, productName, sku, unit, quantity, purchaseNumber, purchaseDate, isExpired, daysToExpiry}], meta:{page,limit,totalCount,totalPages,expiredCount,expiringSoonCount}}` — any role
- `PATCH /:purchaseItemId` — body `{batchNumber, expiryDate?}` → `{data}` — **owner/manager/warehouse_manager**
- `GET /expiry-summary` → `{data:{expiredUnits, expiringSoonUnits, totalBatchedItems}}` — any role
- Prisma: batch fields live directly on `PurchaseItem` (batchNumber, expiryDate, remainingQuantity) — no dedicated `Batch` model
- Suggested screen: `app/batches.tsx` — 3 summary stat cards (expired/expiring-soon/total from `/expiry-summary`) + paginated list with red/amber/green badges by `isExpired`/`daysToExpiry`, optional product filter, tap row to edit batch number/expiry inline.

### 3. TDS Deductions
- Route: `shopkeeper-api/src/routes/tdsDeductions.ts`, mounted at `/tds-deductions`
- `GET /` — query `type?` (tds|gst_tds|tcs), `invoiceId?`, `page?`, `limit?` → `{data: TdsDeduction[], meta:{page,limit,totalCount,totalPages}}` — any role
- `GET /:id` → `{data}` or 404 — any role
- `POST /` — body `{invoiceId?, paymentId?, type, section?, rate, amount, surcharge?, cess?, partyId?, withheldAt?}` → 201 `{data}` — **owner/manager**
- Prisma: `TdsDeduction` (companyId, invoiceId?, paymentId?, type, section?, rate Float, amount Float, surcharge?, cess?, partyId?, withheldAt, createdAt)
- Suggested screen: `app/tds-deductions.tsx` — type filter tabs (All/TDS/GST-TDS/TCS), list with amount/section/date, "Add Deduction" form (type picker, section, rate, amount, optional party/invoice link).

### 4. Product Serials
- Route: `shopkeeper-api/src/routes/productSerials.ts`, mounted at `/product-serials`
- `GET /` — query `productId` (**required**), `status?` → `{data: ProductSerial[]}` — any role
- `POST /bulk` — body `{productId, serialNumbers: string[] (1–500)}` → `{data:{added, skippedDuplicates}}`; 409 if all duplicates — **owner/manager/warehouse_manager**
- Prisma: `ProductSerial` (companyId, productId, serialNumber, status: SerialStatus enum default `in_stock`, invoiceItemId?), unique per (companyId, productId, serialNumber)
- Note: `Product.tracksSerials` flag already exists and is already used at POS checkout (per `KNOWLEDGE-BASE.md` §16) — but there is **no screen anywhere** to view/bulk-add a product's serial inventory today. This is genuinely greenfield, not a partial feature.
- Suggested screen: `app/product-serials.tsx` — product picker (search existing products, filter to `tracksSerials` ones) → serial list with status badges (in_stock/sold/etc.) → "Add Serials" modal accepting a newline/comma-separated paste, calling `/bulk`.

### 5. Compliance
- Route: `shopkeeper-api/src/routes/compliance.ts`, mounted at `/compliance`
- `GET /msme-43bh` → `{data:{reportDate, companyId, flaggedCount, flaggedPurchases:[{purchaseId, purchaseNumber, date, supplierName, msmeUdyamNumber, grandTotal, daysOverdue}], note}}` — MSME suppliers unpaid >45 days (Section 43B(h))
- `GET /msme-suppliers` → `{data:{totalMsmeSuppliers, totalOutstanding, suppliers:[{id,name,msmeUdyamNumber,currentBalance,phone}]}}`
- `GET /tds-summary` → `{data:{totalTdsDeducted, recentDeductions: TdsDeduction[10]}}`
- All three: **owner/manager only**, no dedicated Prisma model (reads `Purchase`/`Party`/`TdsDeduction`)
- Suggested screen: `app/compliance.tsx` — read-only dashboard, 3 sections stacked (43B(h) flagged purchases list, MSME supplier outstanding list, recent TDS deductions) — no forms, just reporting. Natural link target from the TDS screen and/or `gst-reports.tsx`.

### 6. Credit History
- Route: `shopkeeper-api/src/routes/creditHistory.ts`, mounted at `/credit-history`
- `GET /:partyId` → `{data: CreditLimitHistory[]}` (last 100, desc) — **owner/manager only** (router-level `requireRole`)
- `POST /:partyId` — body `{creditLimit (number or ""), reason?}` → `{data:{previousLimit, newLimit}}`, updates `Party.creditLimit` transactionally — **owner/manager only**
- Prisma: `CreditLimitHistory` (companyId, partyId, previousLimit Decimal?, newLimit Decimal?, changedBy, reason?, createdAt)
- Note: credit-limit hard-block is already enforced at POS/B2B checkout (`pos.ts`/`b2b.ts`), but there's no screen to view/change the limit or see its audit trail.
- Suggested screen: `app/credit-history.tsx` — party picker (reuse the existing party-search pattern from `(tabs)/ledger.tsx`) → history list (previous→new limit, reason, changed-by, date) → "Change Limit" form. Alternatively, could be a modal/section added to the existing party detail view in `ledger.tsx` instead of a standalone route — **not yet decided, worth confirming approach before building** since it changes the nav-wiring plan.

**Not yet done — exact next steps for whoever picks this up:**
1. Build the 6 screen files above (none exist yet).
2. Register each in `src/lib/moduleCategories.ts` (add `ModuleItem` entries — Product Attributes/Batches/Product Serials → "Inventory & Products" category; TDS/Compliance/Credit History → "Accounting & Finance" category, matching the `roles` arrays noted per-endpoint above).
3. Add matching nav rows in `app/more.tsx` (or wherever these categories currently render their tile list — check current pattern, e.g. how `/tax-rates` or `/bank-accounts` are wired, and mirror it).
4. Typecheck (`npx tsc --noEmit -p tsconfig.json`) after each screen, not just at the end.
5. Decide credit-history's placement (standalone route vs. embedded in `ledger.tsx`'s party detail) before building it — flagged above, not resolved this session.
6. Update this file's GAP-33 row to ✅ once all 6 are built and wired.

---

## Phase 6: Ongoing — Verification & Maintenance (Gaps 35–37)
**Status:** 🔄 Continuous

| Gap | Check | Frequency | Status |
|-----|-------|-----------|--------|
| GAP-35 | `npx tsc --noEmit` passes zero errors | After every phase | ✅ Passing |
| GAP-36 | Every new screen in `moduleCategories.ts` | When adding screens | ✅ All Phase 2 screens registered |
| GAP-37 | Update `PROJECT_STATUS.md` after each phase | After every phase | ✅ This update |

---

## Module Coverage

| Category | Modules | Screens | Status |
|----------|---------|---------|--------|
| Billing & Sales | 6 | 10 | ✅ Built (Phase 4 migration pending) |
| Inventory & Products | 6 | 9 | ✅ Built (Phase 4 migration pending) |
| Accounting & Finance | 10 | 13 | ✅ Built (Phase 4 migration pending) |
| Staff & HR | 3 | 6 | ✅ Built |
| Operations & Logistics | 2 | 2 | ✅ Built |
| Back Office | 3 | 3 | ✅ Built (Phase 4 migration pending) |
| Settings | 4 | 6 | ✅ Built |

**Total routes:** 36 / 36 ✅

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🖥️  WEB APP (shopkeeper-web) — Separate Workstream
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> Next.js 14 (App Router) + Tailwind v4 + CSS variables (`src/app/globals.css`).
> Dark mode = `.dark` class on `<html>` (custom variant in globals.css).
> **Parallel to the mobile app** — same backend, same 6-phase gap structure.
> Audit performed 20 Jul 2026 (static scan of `src/app/dashboard`, `src/app/admin`, `src/components`).

### Web Overall Progress

| Web Phase | Focus Area | Status | Progress |
|-----------|-----------|--------|----------|
| Web Phase 1 | Critical UX (error feedback, refresh, pagination) | ⬜ Pending | ░░░░░░░░░░ 0% |
| Web Phase 2 | Missing Screens (backend exists, web missing) | ⬜ Pending | ░░░░░░░░░░ 0% |
| Web Phase 3 | Feature Completeness (existing screens) | ⬜ Pending | ░░░░░░░░░░ 0% |
| Web Phase 4 | Design Migration (hex→CSS vars, dark mode, types) | ⬜ Pending | ░░░░░░░░░░ 0% |
| Web Phase 5 | Niche Backend Features | ⬜ Pending | ░░░░░░░░░░ 0% |
| Web Phase 6 | Ongoing — Verification (tsc, ESLint) | 🔄 Continuous | — |

---

### Web Phase 1 — Critical UX (error feedback, refresh, pagination)
**Status:** ⬜ Pending

| Gap | Description | Severity | Status |
|-----|-------------|----------|--------|
| W-GAP-1 | `Toast` component exists (`src/components/Toast.tsx`) but wired into only 1 of ~70 screens (`admin/support`). ~120 `catch {}` blocks do `console.error` only — no user-visible error. | 🔴 Critical | ⬜ Pending |
| W-GAP-2 | No manual refresh on 17+ list pages (web equivalent of mobile pull-to-refresh). Only `daybook` has a reload button. | 🔴 Critical | ⬜ Pending |
| W-GAP-3 | No pagination / infinite scroll on 28 of 32 list routes (history, ledger, inventory, orders, purchases, challans, expenses, etc. pull full collections). | 🔴 Critical | ⬜ Pending |
| W-GAP-4 | Inconsistent safe-area / layout containers (varies per screen) | 🟡 Low | ⬜ Pending |
| W-GAP-5 | No shared `DatePicker` component — 13 screens use native `<input type="date">` / free-text (no dark-mode styling, no range presets). | 🟧 Medium | ⬜ Pending |

**Worst offenders:** `history`, `ledger`, `inventory`, `compliance`, `activity-log`, `b2b`, `challans`, `expenses` (silent catches); `ledger`, `inventory`, `orders`, `purchases`, `challans` (no pagination).

---

### Web Phase 2 — Missing Screens (backend exists, web missing)
**Status:** ⬜ Pending

> 23 missing dashboard/admin routes vs the mobile route set (55 mobile screens):

| Missing web route | Mobile source | Priority |
|-------------------|---------------|----------|
| `tax-rates` | tax-rates.tsx | High |
| `outlets` | outlets.tsx | High |
| `brands` | brands.tsx | High |
| `stock-transfer-requests` | stock-transfer-requests.tsx | High |
| `gst-reports` | gst-reports.tsx | High |
| `aging-report` | aging-report.tsx | High |
| `balance-sheet` | balance-sheet.tsx | High |
| `pnl-report` | pnl-report.tsx | High |
| `gst-rate-tools` | gst-rate-tools.tsx | Medium |
| `financial-year` | financial-year.tsx | Medium |
| `notifications` | notifications.tsx (only `AdminNotificationBell` component exists) | Medium |
| `reminders` | reminders.tsx | Medium |
| `reorder-suggestions` | reorder-suggestions.tsx | Medium |
| `scanned-documents` | scanned-documents.tsx | Medium |
| `purchase-entry` | purchase-entry.tsx | Medium |
| `barcode-generator` | barcode-generator.tsx (web has `barcodes`, no generator) | Low |
| `bill-scanner` | bill-scanner.tsx | Low |
| `bulk-price-update` | bulk-price-update.tsx | Low |
| `printer-settings` | printer-settings.tsx | Low |
| `global-search` | global-search.tsx (navigation) | Low |
| `profile` | profile.tsx (navigation) | Low |
| `onboarding` | onboarding.tsx (navigation) | Low |
| `more` | more.tsx (navigation) | Low |

---

### Web Phase 3 — Feature Completeness (existing screens)
**Status:** ⬜ Pending

| Gap | Description | Screen | Status |
|-----|-------------|--------|--------|
| W-GAP-12 | Invoice detail missing actions (print/share/PDF/void/return/send) | `history` | ⬜ Pending |
| W-GAP-13 | B2B/Purchase tabs not pressable to detail | `history` | ⬜ Pending |
| W-GAP-14 | Recurring invoice: multi-product, edit, date picker | `recurring-invoices` | ⬜ Pending |
| W-GAP-15 | Sales order → Convert to Invoice | `sales-orders` | ⬜ Pending |
| W-GAP-16 | No purchase detail view | `purchases` | ⬜ Pending |
| W-GAP-17 | Challan creation gaps (scanner, item edit, debounced search) | `challans` | ⬜ Pending |
| W-GAP-18 | Staff cannot self-mark attendance | `attendance` | ⬜ Pending |
| W-GAP-19 | Attendance dead imports / silent errors | `attendance` | ⬜ Pending |
| W-GAP-20 | Payroll dead imports / confirm on process | `payroll/*` | ⬜ Pending |
| W-GAP-21 | Leaves missing user picker | `payroll/leaves` | ⬜ Pending |
| W-GAP-22 | Holiday delete no confirmation | `payroll/holidays` | ⬜ Pending |
| W-GAP-23 | Shop hours missing time validation | `payroll/shop-hours` (if exists) | ⬜ Pending |
| W-GAP-24 | No search/filter on key lists | history, sales-orders, activity-log, recycle-bin | ⬜ Pending |
| W-GAP-25 | Export to PDF missing | All | ⬜ Pending |

---

### Web Phase 4 — Design Migration (hex → CSS vars, dark mode, types)
**Status:** ⬜ Pending

| Gap | Description | Severity | Status |
|-----|-------------|----------|--------|
| W-GAP-26 | Hardcoded hex colors (~140+ hits / ~35 files) bypass `var(--…)`. Worst: `invoice-templates` (~50), `pos` (~18), `analytics` (chart palette), `b2b`, `ledger`, `inventory`, `billing`. | 🟣 Design | ⬜ Pending |
| W-GAP-27 | Broken/missing dark mode on 14+ screens (light-only `bg-white`/`#fff`/no `dark:` counterpart): `agents`, `back-office`, `barcodes/print`, `categories`, `orders`, `price-lists`, `purchase-orders`, `referrals`, `sales-orders`, `settings`, `app/page`, `AuthLayout`, `saa-s-template`, `switch`. | 🟣 Design | ⬜ Pending |
| W-GAP-28 | No centralized theme tokens usage — many files inline `style={{color:"#0368FE"}}` instead of `text-primary` / `var(--primary)`. | 🟣 Design | ⬜ Pending |
| W-GAP-29 | Dead imports (~51 flagged across ~20 files — needs `tsc --noUnusedLocals` confirm). Clusters: `b2b`, `layout`, `settings`, `pos`, admin `audit-log`/`team`/`customers`/`leads`/`support`. | 🟣 Design | ⬜ Pending |
| W-GAP-30 | Inconsistent layout containers (no shared page wrapper convention everywhere). | 🟣 Design | ⬜ Pending |
| W-GAP-31 | `any` in component data state (~110 hits). Worst: `analytics` (27), `pos` (13), `inventory` (9), `b2b` (7), `orders`/`estimates` (6 each). | 🟣 Design | ⬜ Pending |
| W-GAP-32 | No shared UI components for some patterns — raw `<div>`/`<input>` instead of `components/ui/*` (button, card, search-input, switch, form-field all exist but underused). | 🟣 Design | ⬜ Pending |

**Top 10 worst-offending web files:** `invoice-templates`, `pos`, `analytics`, `inventory`, `ledger`, `compliance`, `history`, `activity-log`, `b2b`, `Toast.tsx` (orphaned).

---

### Web Phase 5 — Niche Backend Features
**Status:** ⬜ Pending

| Gap | Description | Status |
|-----|-------------|--------|
| W-GAP-33 | Low-value endpoints not surfaced (`/product-attributes`, `/batches`, `/tds-deductions`, `/product-serials`, `/compliance`, `/credit-history`) | ⬜ Pending |
| W-GAP-34 | No GST return line items drill-down on screen | ⬜ Pending |

---

### Web Phase 6 — Ongoing Verification & Maintenance
**Status:** 🔄 Continuous

| Check | Frequency | Status |
|-------|-----------|--------|
| `npx tsc --noEmit` passes (web) | After every phase | ⬜ Not yet run in this tracking |
| `eslint` clean (unused imports, implicit any) | After every phase | ⬜ Pending |
| Update `PROJECT_STATUS.md` | After every phase | ✅ This entry added |

---

*Last updated: 22 Jul 2026*
