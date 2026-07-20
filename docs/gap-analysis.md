# Mobile App Gap Analysis — Complete Master List

> Generated from deep audit of all 34 modules (54 screens) vs backend API.
> Organized into 6 phases for sequential remediation.

---

## Phase 1: Foundation — Critical UX & Core Features

### GAP-1 — No Pull-to-Refresh on 19 Screens
**Severity:** 🔴 Critical  
**Affected screens:** All 9 Inventory screens, all 13 Accounting/Finance screens, staff, recycle-bin, account-security, support-tickets, referral-program, invoice-history, estimates, recurring-invoices, price-lists, b2b, pos  
**Fix:** Add `<RefreshControl>` to `FlatList`/`ScrollView` on every screen. ~2 days.

### GAP-2 — No Error Feedback to Users
**Severity:** 🔴 Critical  
**Affected screens:** ~40% of screens have silent `catch {}` blocks with no user-facing feedback  
**Fix:** Replace silent catches with snackbar/toast. Use `Snackbar` from Paper in all mutation paths. ~3 days.

### GAP-3 — No Pagination / Infinite Scroll on Large Lists
**Severity:** 🔴 Critical  
**Affected screens:** inventory, invoice-history, activity-log, recycle-bin, unified-ledger (load all), estimates, price-lists, sales-orders, purchase-entry (hardcoded `.slice`)  
**Fix:** Add `page`/`limit` query params, pagination controls or FlatList `onEndReached`. ~4 days.

### GAP-4 — Missing `useBottomInset()` on 9 Screens
**Severity:** 🔴 Critical  
**Affected screens:** payment-history, bank-reconciliation, gst-reports, pnl-report, balance-sheet, aging-report, barcode-generator, recycle-bin, scanned-documents  
**Fix:** Add bottom inset to content container `paddingBottom`. ~1 day.

### GAP-5 — No Date Picker Anywhere
**Severity:** 🟧 Medium  
**Affected screens:** payment-history, gst-reports, pnl-report, balance-sheet, aging-report, daybook, credit-note, debit-note, leaves, holidays, purchase-history, bank-reconciliation, and all report screens  
**Fix:** Build a reusable `<DatePickerModal>` using Paper's `Dialog` + scrollable date grid. ~2 days.

---

## Phase 2: New Screens — Backend Has API, App Has Nothing

### GAP-6 — No Notification Inbox
**Severity:** 🔴 Critical  
**Backend:** `GET /notifications`, `PATCH /:id/read`, `POST /read-all`, `DELETE /clear-all`  
**Fix:** Build `app/notifications.tsx` — list with unread badge, mark-read swipe, clear-all. Badge on tab bar. ~3 days.

### GAP-7 — No Outlet/Location Management
**Severity:** 🟧 Medium  
**Backend:** Full CRUD at `/outlets`  
**Fix:** Build `app/outlets.tsx` — list, create, edit, toggle active. ~2 days.

### GAP-8 — No Overdue Payment Reminder Flow
**Severity:** 🟧 Medium  
**Backend:** `GET /reminders/overdue`, `POST /:partyId/mark-sent`  
**Fix:** Build `app/reminders.tsx` — overdue parties list, mark-reminder-sent, WhatsApp deep-link. ~2 days.

### GAP-9 — No Brand Management UI
**Severity:** 🟧 Medium  
**Backend:** Full CRUD at `/brands`  
**Fix:** Build `app/brands.tsx` — list, create, edit, delete. ~1 day.

### GAP-10 — No Counter Management
**Severity:** 🟡 Low  
**Backend:** Full CRUD at `/counters`  
**Fix:** Build `app/counters.tsx` — list, create, assign staff. ~1 day.

### GAP-11 — No Tax Rate Management UI
**Severity:** 🟡 Low  
**Backend:** Full CRUD at `/tax-rates`  
**Fix:** Build `app/tax-rates.tsx` — list, create, edit. ~1 day.

---

## Phase 3: Feature Completeness — Missing Module Features

### GAP-12 — Invoice History Missing Actions
**Severity:** 🟧 Medium  
**Screen:** `app/invoice-history.tsx`  
**Missing:** Print, share, download PDF, void invoice, return/refund, send to customer buttons in detail modal  
**Fix:** Add action buttons to invoice detail view. ~2 days.

### GAP-13 — B2B & Purchase Tabs Not Navigable
**Severity:** 🟧 Medium  
**Screen:** `app/invoice-history.tsx`  
**Missing:** B2B and Purchase tab items are not pressable — no detail view  
**Fix:** Add `onPress` handlers and detail modals. ~2 days.

### GAP-14 — Recurring Invoice Limitations
**Severity:** 🟧 Medium  
**Screen:** `app/recurring-invoices.tsx`  
**Missing:** Multi-product support, edit capability, date picker, linked invoice history  
**Fix:** Refactor form to accept multiple line items, add edit mode, add date picker. ~2 days.

### GAP-15 — Sales Order → Invoice Missing
**Severity:** 🟧 Medium  
**Screen:** `app/sales-orders.tsx`  
**Missing:** "Convert to Invoice" action on sales orders  
**Fix:** Add convert button calling `/sales-orders/:id/convert`. ~1 day.

### GAP-16 — No Purchase Detail View
**Severity:** 🟧 Medium  
**Screen:** `app/purchase-history.tsx`  
**Missing:** Tapping a purchase row opens return form instead of detail view  
**Fix:** Add purchase detail modal with items breakdown. ~1 day.

### GAP-17 — Challan Creation Gaps
**Severity:** 🟧 Medium  
**Screen:** `app/challans.tsx`  
**Missing:** Barcode scanner for product add, item-level editing, debounced party search  
**Fix:** Add scanner integration, debounce search, add edit-draft mode. ~2 days.

### GAP-18 — Staff Cannot Self-Mark Attendance
**Severity:** 🟧 Medium  
**Screen:** `app/attendance.tsx`  
**Missing:** Staff role is gated out of check-in/check-out. Staff have no self-service attendance flow.  
**Fix:** Add staff-facing check-in screen with simplified UI. ~1 day.

### GAP-19 — Attendance Feature Gaps
**Severity:** 🟡 Low  
**Screen:** `app/attendance.tsx`  
**Missing:** Dead imports (Portal, Dialog, Menu, List), silent catch blocks  
**Fix:** Remove dead imports, add error snackbars. ~0.5 day.

### GAP-20 — Payroll Dead Imports & Missing Dark Mode
**Severity:** 🟡 Low  
**Screen:** `app/payroll.tsx`  
**Missing:** Dead imports (SegmentedButtons, List), no `dark:` classes, no confirmation dialog before processing payments  
**Fix:** Remove dead imports, add dark classes, add confirmation dialog. ~0.5 day.

### GAP-21 — Leaves Missing User Picker
**Severity:** 🟡 Low  
**Screen:** `app/leaves.tsx`  
**Missing:** Manager creating a leave must type raw User ID — no user picker  
**Fix:** Add staff selector dialog. ~0.5 day.

### GAP-22 — Holiday Delete No Confirmation
**Severity:** 🟡 Low  
**Screen:** `app/holidays.tsx`  
**Missing:** Delete is one-tap permanent, no confirmation dialog  
**Fix:** Add confirm dialog before delete. ~0.5 day.

### GAP-23 — Shop Hours Missing Time Picker
**Severity:** 🟡 Low  
**Screen:** `app/shop-hours.tsx`  
**Missing:** Open/close times are free-text HH:MM with no validation or picker  
**Fix:** Add time-picker component or input validation. ~0.5 day.

### GAP-24 — No Search/Filter on Key Lists
**Severity:** 🟧 Medium  
**Affected:** invoice-history, sales-orders, activity-log, recycle-bin  
**Missing:** Search by number/customer/date, status filter, user filter  
**Fix:** Add Paper `Searchbar` + filter chips to each screen. ~3 days.

### GAP-25 — Export to PDF Missing
**Severity:** 🟡 Low  
**Affected:** All screens  
**Missing:** No PDF export anywhere (only CSV in GST reports)  
**Fix:** Add `react-native-print` or backend PDF-generation call. ~2 days.

---

## Phase 4: Design Migration — Retrofit ~40 Screens to MD3 Paper

### GAP-26 — Hardcoded `#0368FE` Everywhere
**Severity:** 🟣 Design  
**Affected:** ~150+ occurrences across ~40 old-system screens  
**Fix:** Replace all with `theme.colors.primary` from Paper + `useTheme()`. ~5 days.

### GAP-27 — Dark Mode Broken on 5 Screens
**Severity:** 🟣 Design  
**Screens:** payment-history, pnl-report, aging-report, support-tickets, reorder-suggestions  
**Fix:** Add `dark:` Tailwind classes; replace hardcoded `#f8fafc` backgrounds. ~2 days.

### GAP-28 — No `useTheme()` in ~40 Screens
**Severity:** 🟣 Design  
**Affected:** All old-system screens (POS, B2B, Estimates, Inventory, Ledger, etc.)  
**Fix:** Import `useTheme()` and replace hardcoded colors with theme tokens. ~5 days.

### GAP-29 — Dead Imports in 5 Screens
**Severity:** 🟣 Design  
**Screens:** attendance (Portal, Dialog, Menu, List), payroll (SegmentedButtons, List), leaves (SegmentedButtons), holidays (Snackbar — never rendered), support-tickets (useSafeAreaInsets)  
**Fix:** Remove unused imports. ~0.5 day.

### GAP-30 — Inconsistent Safe Area Patterns
**Severity:** 🟣 Design  
**Affected:** Mixed usage of custom hooks vs `useSafeAreaInsets()` vs missing entirely  
**Fix:** Standardize on Paper-compatible pattern across all screens. ~2 days.

### GAP-31 — Type `any` in Data States
**Severity:** 🟣 Design  
**Screens:** pnl-report, balance-sheet, aging-report  
**Fix:** Define proper TypeScript interfaces for all data shapes. ~1 day.

### GAP-32 — No Paper `SegmentedButtons` / `Searchbar` / `Card` on Old Screens
**Severity:** 🟣 Design  
**Affected:** ~40 screens use raw RN `Pressable` toggles, raw `TextInput`, raw `View` with border radius  
**Fix:** Replace with Paper equivalents: `SegmentedButtons`, `Searchbar`, `Card`. ~8 days.

---

## Phase 5: New Backend-Linked Features (Niche / Low-Value)

### GAP-33 — Low-Value Endpoints Not Surfaced
**Severity:** 🟡 Low  
**Endpoints:** `/product-attributes`, `/batches`, `/tds-deductions`, `/product-serials`, `/compliance`, `/credit-history`  
**Fix:** Build minimal screens only if user demand exists. ~5 days total.

### GAP-34 — No GST Return Line Items
**Severity:** 🟡 Low  
**Screen:** `app/gst-reports.tsx`  
**Missing:** B2B/B2C line items only available via CSV export, not viewable on screen  
**Fix:** Add drill-down to show individual invoice lines within each GST summary section. ~2 days.

---

## Phase 6: Ongoing — Verification & Maintenance

### GAP-35 — TypeScript Clean Build
**Check:** `npx tsc --noEmit` passes with zero errors  
**Frequency:** After every phase

### GAP-36 — Update Module Registration
**Check:** Every new screen added to `src/lib/moduleCategories.ts` with correct route, icon, label, role  
**Frequency:** When adding screens in Phases 2–5

### GAP-37 — Update PROJECT_STATUS.md
**Check:** After each phase, update `docs/PROJECT_STATUS.md` with completed items  
**Frequency:** After every phase

---

## Master Summary

| Phase | Gaps | Focus Area | Est. Effort |
|-------|------|------------|-------------|
| **Phase 1** | 1–5 | Critical UX foundations | ~12 days |
| **Phase 2** | 6–11 | New screens (backend exists, app missing) | ~10 days |
| **Phase 3** | 12–25 | Feature completeness on existing screens | ~18 days |
| **Phase 4** | 26–32 | Design migration to MD3 Paper | ~23 days |
| **Phase 5** | 33–34 | Niche backend features | ~7 days |
| **Phase 6** | 35–37 | Ongoing verification | Ongoing |
| | **37 total** | | **~70 days est.** |

---

*Last updated: 20 Jul 2026*
