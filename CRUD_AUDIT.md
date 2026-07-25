# Shopkeeper Mobile App — CRUD Audit Catalog

> **Generated**: Full scan of all 62 screen files under `app/` + `_layout.tsx`  
> **API Client**: `src/lib/api.ts` — `api.get/post/patch/put/delete`  
> **Confirmation**: `useConfirm()` from `src/components/ConfirmDialog` (native `Alert.alert` in legacy spots)  
> **Role Gating**: `useAuth().userRole`, `useRoleGate()`, `useModuleVisibility()`  
> **Swipe Actions**: None observed anywhere  

---

## 1. Auth Module

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Login | `(auth)/login.tsx` | — | `POST /auth/login` | No | No |
| Register | `(auth)/register.tsx` | C | `POST /auth/register` | No | No |
| Forgot Password | `(auth)/forgot-password.tsx` | — | `POST /auth/forgot-password` | No | No |

**Notes**: No role gating; standard auth flow. No confirmation dialogs.

---

## 2. Dashboard / Home

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Dashboard | `(tabs)/index.tsx` | R | `GET /dashboard`, `GET /dashboard/summary` | Yes — staff sees limited view | No |

**Actions**: Quick-action cards (Scan, POS, Add Customer, etc.), KPI cards, recent activity feed, outlet switcher.  
**Data**: Today's sales, cash/UPI totals, bill count, pending approvals count, stock alerts count.

---

## 3. Point of Sale

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| POS | `(tabs)/pos.tsx` | C, R | `GET /products`, `GET /parties?type=customer`, `GET /price-lists`, `POST /invoices`, `GET /warehouses` | No | Native `Alert.alert` for confirm |
| Shift Reconciliation | `shift-reconciliation.tsx` | C, U | `GET /shifts/active`, `POST /shifts/start`, `POST /shifts/close`, `PATCH /shifts/:id/reconcile`, `GET /shifts/outlet` | Yes — staff vs manager views | No |

**POS Actions**: Search products, add to cart, select customer, select warehouse, apply discounts, select payment mode (cash/UPI/credit), print receipt, complete sale.  
**POS Data**: Products (id, name, price, sku, unit, tax_rate), Customers (id, name), Price lists, Cart items.  
**Shift Reconciliation**: Start/close shift, cash counting with numpad, discrepancy alerts, manager reconcile outlet shifts.

---

## 4. Inventory / Products

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Inventory | `(tabs)/inventory.tsx` | R | `GET /products` (+ params) | No | No |
| Brands | `brands.tsx` | CRUD | `GET /brands`, `POST /brands`, `PATCH /brands/:id`, `DELETE /brands/:id` | No | `useConfirm()` for delete |
| Categories | `categories.tsx` | CRUD | `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` | No | `useConfirm()` for delete |
| Barcode Generator | `barcode-generator.tsx` | R | `GET /products` | No | No |
| Bulk Price Update | `bulk-price-update.tsx` | U | `GET /products`, `POST /products/bulk-update-prices` | No | `useConfirm()` before update |
| Reorder Suggestions | `reorder-suggestions.tsx` | R, C | `GET /purchases/reorder-suggestions`, `GET /purchase-orders/suggestions/suppliers`, `POST /purchase-orders/generate-from-suggestions` | No | No |
| Stock Transfer Requests | `stock-transfer-requests.tsx` | CRUD | `GET /stock-transfer-requests`, `POST /stock-transfer-requests`, `PATCH /stock-transfer-requests/:id`, `GET /warehouses`, `GET /products` | No | `useConfirm()` for status changes & remove items |

**Inventory List**: Search/filter by category, brand, low stock. Tap to edit product details.  
**Brands**: List brands, add/edit via modal, delete with confirmation.  
**Categories**: Same pattern as brands.  
**Barcode Generator**: Select product, generate barcode, print/download.  
**Bulk Price Update**: Select products, set price adjustment (flat/percentage), apply.  
**Reorder Suggestions**: Products below reorder level with suggested quantities, select items, choose supplier, auto-generate PO.  
**Stock Transfers**: Create transfer requests between warehouses, approve/reject/complete workflow with status filter.

---

## 5. Purchase Module

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Purchase Entry | `purchase-entry.tsx` | C | `GET /parties?type=supplier`, `GET /products`, `GET /warehouses`, `POST /purchases` | No | No |
| Purchase History | `purchase-history.tsx` | R, C | `GET /purchases`, `POST /debit-notes` | No | `useConfirm()` for return creation |
| Purchase Orders | `purchase-orders.tsx` | CRUD | `GET /purchase-orders`, `POST /purchase-orders`, `PATCH /purchase-orders/:id/status`, `POST /purchase-orders/:id/receive`, `GET /products`, `GET /parties?type=supplier` | No | `useConfirm()` for cancel PO |

**Purchase Entry**: Select supplier/warehouse, search products, cart with qty/cost, RCM toggle, record purchase.  
**Purchase History**: Search by #, view detail, create return/debit note with per-item quantities.  
**Purchase Orders**: Two-tab layout (list/new), create PO with cart, status transitions (draft→sent→partial→received→cancelled), receive items modal.

---

## 6. Sales / Invoicing Module

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Invoice History | `(tabs)/invoice-history.tsx` | R | `GET /invoices` (+ params) | No | No |
| Sales Orders | `sales-orders.tsx` | CRUD | `GET /sales-orders`, `POST /sales-orders`, `PATCH /sales-orders/:id/status`, `POST /sales-orders/:id/deliver`, `POST /sales-orders/:id/convert`, `GET /products`, `GET /parties?type=customer` | No | `useConfirm()` for cancel |
| Estimates | `estimates.tsx` | CRUD | `GET /estimates`, `POST /estimates`, `PATCH /estimates/:id`, `DELETE /estimates/:id`, `POST /estimates/:id/convert` | No | `useConfirm()` for delete |
| Credit Note | `credit-note.tsx` | CRUD | `GET /credit-notes`, `POST /credit-notes`, `GET /invoices` | No | No |
| Debit Note | `debit-note.tsx` | CRUD | `GET /debit-notes`, `POST /debit-notes`, `GET /purchases` | No | No |
| Recurring Invoices | `recurring-invoices.tsx` | CRUD | `GET /recurring-invoices`, `POST /recurring-invoices`, `PATCH /recurring-invoices/:id`, `DELETE /recurring-invoices/:id` | No | Native `Alert.alert` for delete |
| Challans | `challans.tsx` | CRUD | `GET /challans`, `POST /challans`, `PATCH /challans/:id`, `GET /parties?type=customer`, `GET /products` | No | `useConfirm()` for delete |
| Invoice Templates | `invoice-templates.tsx` | CRUD | `GET /invoice-templates`, `POST /invoice-templates`, `PATCH /invoice-templates/:id`, `DELETE /invoice-templates/:id` | No | `useConfirm()` for delete |
| B2B | `b2b.tsx` | R | `GET /invoices/b2b` | No | No |

**Invoice History**: Search by number/party/customer, filter by date, export PDF, view detail, share.  
**Sales Orders**: Two-tab (list/new), status transitions (draft→confirmed→partial→delivered→cancelled), record delivery, convert to invoice.  
**Estimates**: Create estimates with products, convert to invoice.  
**Credit/Debit Notes**: List, create from invoices/purchases.  
**Recurring Invoices**: Weekly/monthly/quarterly/yearly schedules, pause/resume, edit template.  
**Challans**: Delivery challans for goods transit.  
**Invoice Templates**: Design templates for printed invoices.  
**B2B**: Business-to-business invoice listing.

---

## 7. Parties / Customers / Suppliers

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Ledger | `ledger.tsx` | R | `GET /parties`, `GET /parties/:id/ledger` (+ params) | No | No |
| Unified Ledger | `unified-ledger.tsx` | R | `GET /ledger/unified/all` (+ pagination) | No | No |
| Aging Report | `aging-report.tsx` | R | `GET /reports/aging` (+ params) | No | No |
| Customer Groups | `customer-groups.tsx` | CRUD | `GET /customer-groups`, `POST /customer-groups`, `PATCH /customer-groups/:id`, `DELETE /customer-groups/:id` | No | `useConfirm()` for delete |
| Agents | `(tabs)/agents.tsx` | R | `GET /agents` | No | No |

**Ledger**: Per-party view with search, date filter, debit/credit entries, running balance.  
**Unified Ledger**: All transactions across all parties, paginated (50/page), search/filter by party type.  
**Aging Report**: Overdue amounts by aging buckets, per-party breakdown.  
**Customer Groups**: Create/edit pricing groups, delete with confirmation.  
**Agents**: List field agents with contact info.

---

## 8. Financial Reports

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| P&L Report | `pnl-report.tsx` | R | `GET /reports/pnl` (+ params from/to) | No | No |
| Balance Sheet | `balance-sheet.tsx` | R | `GET /reports/balance-sheet` | No | No |
| GST Reports | `gst-reports.tsx` | R | `GET /reports/gst` (+ params) | No | No |
| Daybook | `daybook.tsx` | R | `GET /daybook` (+ params date) | No | No |
| Analytics | `analytics.tsx` | R | `GET /analytics` (+ params) | No | No |

**P&L Report**: Date range selector, revenue/COGS/gross profit/expenses/net profit.  
**Balance Sheet**: Assets, liabilities, equity snapshot.  
**GST Reports**: GSTR-1, GSTR-3B summaries, filing data.  
**Daybook**: Daily transaction journal.  
**Analytics**: Sales trends, top products, customer analytics.

---

## 9. Banking & Payments

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Payment History | `(tabs)/payment-history.tsx` | R | `GET /payments` (+ params) | No | No |
| Bank Accounts | `bank-accounts.tsx` | CRUD | `GET /bank-accounts`, `POST /bank-accounts`, `PATCH /bank-accounts/:id`, `DELETE /bank-accounts/:id` | No | `useConfirm()` for delete |
| Bank Reconciliation | `bank-reconciliation.tsx` | R, U | `GET /bank-reconciliation`, `PATCH /bank-reconciliation/:id/reconcile` | No | No |

**Payment History**: Filter by mode/date, view all payments received/made, export PDF.  
**Bank Accounts**: Add/edit/delete bank accounts, set default.  
**Bank Reconciliation**: Match transactions against statements.

---

## 10. HR / Staff Management

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Staff | `staff.tsx` | CRUD | `GET /staff`, `POST /staff`, `PATCH /staff/:id`, `DELETE /staff/:id` | Yes — `useRoleGate(["owner","manager"])` | `useConfirm()` for discard changes & delete |
| Attendance | `attendance.tsx` | CRUD | `GET /attendance`, `POST /attendance`, `PATCH /attendance/:id` | Yes — owner/manager can edit | No |
| Payroll | `payroll.tsx` | CRUD | `GET /payroll/settings`, `PUT /payroll/settings`, `POST /payroll/calculate`, `POST /payroll/process` | Yes — owner/manager can edit settings & process | `useConfirm()` for process payroll |
| Leaves | `leaves.tsx` | CRUD | `GET /leaves`, `POST /leaves`, `PATCH /leaves/:id/status` | Yes — staff vs manager view | No |
| Holidays | `holidays.tsx` | CRUD | `GET /holidays`, `POST /holidays`, `DELETE /holidays/:id` | Yes — owner/manager can manage | `useConfirm()` for delete |
| Shop Hours | `shop-hours.tsx` | CRUD | `GET /leave-management/shop-hours`, `PUT /leave-management/shop-hours`, `DELETE /leave-management/shop-hours/:day` | Yes — owner/manager can edit | No |
| Invite Staff | `invite-staff.tsx` | C | `POST /staff/invite` | Yes — owner/manager | No |

**Staff**: List all staff, add with role selection (manager/staff/warehouse_manager/field_agent), login toggle, auto-generate temp password, WhatsApp invite with app download link.  
**Attendance**: Mark attendance, view history, edit.  
**Payroll**: Two-tab (settings/calculate), set pay-per-day and base pay per employee, calculate payroll for month, process payments.  
**Leaves**: Apply for leave, approve/reject.  
**Holidays**: Manage holiday calendar.  
**Shop Hours**: Set open/close times per weekday, active/inactive toggle.  
**Invite Staff**: Send invite link via WhatsApp/SMS.

---

## 11. Expenses

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Expenses | `expenses.tsx` | CRUD | `GET /expenses`, `POST /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id` | No | `useConfirm()` for delete |

**Actions**: Add expense with category/amount/date/notes/attachment, edit, delete.  
**Data**: Expense categories, amount, date, payment mode, attachments.

---

## 12. Tax Settings

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Tax Rates | `tax-rates.tsx` | CRUD | `GET /tax-rates`, `POST /tax-rates`, `PATCH /tax-rates/:id`, `DELETE /tax-rates/:id` | No | `useConfirm()` for delete |
| GST Rate Tools | `gst-rate-tools.tsx` | R | `GET /gst-rate-tools` | No | No |
| Financial Year | `financial-year.tsx` | CRUD | `GET /financial-years`, `POST /financial-years`, `PATCH /financial-years/:id` | No | No |

**Tax Rates**: Manage GST/cess/other tax rates, active/inactive.  
**GST Rate Tools**: HSN/SAC code lookup, rate reference.  
**Financial Year**: Manage accounting periods, open/close FY.

---

## 13. Settings & Configuration

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Profile | `(tabs)/profile.tsx` | R | `GET /companies/me`, `GET /users/me` | No | No |
| Business Profile | `business-profile.tsx` | U | `PATCH /companies/me` | Yes — owner only | No |
| Account Security | `account-security.tsx` | U | `PATCH /auth/change-password` | No | No |
| Modules Settings | `modules-settings.tsx` | R, U | `GET /modules`, `PATCH /modules` | Yes — owner only | No |
| Subscription Billing | `subscription-billing.tsx` | R, U | `GET /plans`, `GET /companies/me`, `GET /staff`, `GET /warehouses`, `PATCH /companies/subscription` | No | Native `Alert.alert` for confirm |
| Outlets | `outlets.tsx` | CRUD | `GET /outlets`, `POST /outlets`, `PATCH /outlets/:id`, `DELETE /outlets/:id` | No | `useConfirm()` for delete |
| Counters | `counters.tsx` | CRUD | `GET /counters`, `POST /counters`, `PATCH /counters/:id`, `DELETE /counters/:id` | No | `useConfirm()` for delete |
| Printer Settings | `printer-settings.tsx` | R, C, D | Bluetooth/USB/WiFi scan, connect, add/remove/set-default (local `thermalPrinter` lib) | No | No |
| Price Lists | `price-lists.tsx` | CRUD | `GET /price-lists`, `POST /price-lists`, `PATCH /price-lists/:id`, `DELETE /price-lists/:id`, `GET /price-lists/:id/items`, `POST /price-lists/:id/items`, `PATCH /price-lists/:id/items/:id`, `DELETE /price-lists/:id/items/:id` | No | `useConfirm()` for delete |
| Referral Program | `referral-program.tsx` | CRUD | `GET /referral-programs`, `POST /referral-programs`, `PUT /referral-programs/:id` | No | No |
| Barcode Scanner | `bill-scanner.tsx` | — | Uses `scanCapture` lib | No | No |

**Profile**: View user info, company details, subscription info.  
**Business Profile**: Edit company name, address, GSTIN, logo, etc.  
**Account Security**: Change password.  
**Modules Settings**: Enable/disable business modules (inventory, POS, payroll, etc.).  
**Subscription Billing**: View current plan, usage bars (staff/warehouses), browse/switch plans.  
**Outlets**: Multi-outlet management with address/phone/GSTIN, active/inactive.  
**Counters**: POS counter management per outlet.  
**Printer Settings**: Discover and pair Bluetooth/USB/WiFi thermal printers, set default, paper width (58/80mm).  
**Price Lists**: Create sale/purchase price lists, add products with custom pricing/min qty, set default.  
**Referral Program**: Create referral reward programs (% or fixed), active/pause toggle.

---

## 14. Notifications & Communication

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Notifications | `notifications.tsx` | R, U | `GET /notifications`, `PATCH /notifications/:id/read` | No | No |
| Live Activity | `live-activity.tsx` | R | `GET /live-activity` | No | No |

**Notifications**: List with read/unread, tap to mark read, grouped by date.  
**Live Activity**: Real-time feed of sales/stock changes across the business.

---

## 15. Support & System

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Support Tickets | `support-tickets.tsx` | CRUD | `GET /support-tickets`, `GET /support-tickets/:id`, `POST /support-tickets`, `POST /support-tickets/:id/messages` | No | No |
| Onboarding | `onboarding.tsx` | U | `PATCH /companies/onboarding` | No | No |
| Global Search | `(tabs)/global-search.tsx` | R | `GET /search` (+ query) | No | No |

**Support Tickets**: Create tickets with priority, threaded messages (reply UI).  
**Onboarding**: Wizard for first-time setup (business details, products, etc.).  
**Global Search**: Search across all entities (products, parties, invoices).

---

## 16. Audit & Compliance

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Activity Log | `activity-log.tsx` | R | `GET /activity-log` (+ pagination) | Yes — owner/manager | No |
| Approval Queue | `approval-queue.tsx` | R, U | `GET /approval-queue`, `PATCH /approval-queue/:id/approve`, `PATCH /approval-queue/:id/reject` | Yes — owner/manager | `useConfirm()` for approve/reject |
| Recycle Bin | `recycle-bin.tsx` | R, U | `GET /:kind/recycle-bin/list`, `POST /:kind/:id/restore` | No | `useConfirm()` for restore |

**Activity Log**: Paginated audit trail of all user actions.  
**Approval Queue**: Pending approvals (credit limit overrides, discounts, refunds), approve/reject with confirmation.  
**Recycle Bin**: Deleted products/parties/invoices, paginated (50/page), search, restore with confirmation. Kinds: products, parties, invoices.

---

## 17. Additional Utilities

| Screen | File | CRUD | API Endpoints | Role-Aware | Confirm Dialogs |
|--------|------|------|---------------|------------|-----------------|
| Scanned Documents | `scanned-documents.tsx` | R, D | Local `scanCapture` lib: `listScans()`, `deleteScan()` | No | Native `Alert.alert` for delete |
| Reminders | `reminders.tsx` | R, U | `GET /reminders/overdue`, `POST /reminders/:id/mark-sent` | No | No |
| More | `(tabs)/more.tsx` | — | Navigation menu only | No | No |

**Scanned Documents**: Grid of scanned purchase bills/products/expenses/transfers, filter by category, view fullscreen, long-press to delete.  
**Reminders**: Overdue payment reminders grouped by severity (urgent 30d+, warning 15d+, notice <15d), total overdue summary, send WhatsApp reminder.  
**More**: Navigation hub linking to all secondary screens.

---

## Cross-Cutting Patterns

### Role Gating
- **`useRoleGate(roles, message)`**: Blocks entire screen (Staff, Modules Settings)
- **`useAuth().userRole`**: Conditional UI visibility (Payroll edit button, Shift manager view, Shop Hours edit)
- **`useModuleVisibility()`**: Module-level feature hiding

### Confirmation Dialogs
- **`useConfirm()`** (standard): 45+ screens use this for delete/destructive actions
- **Native `Alert.alert`** (legacy): Used in POS, Recurring Invoices delete, Subscription plan change, Scanned Documents delete

### Pagination
- **Infinite scroll**: Recycle Bin (50/page), Unified Ledger (50/page), Activity Log
- **Standard FlatList**: Most list screens load all data at once

### Data Export
- **PDF Export**: Invoice History, Purchase History, Sales Orders (`shareDataAsPdf` from `src/lib/pdfExport`)
- **WhatsApp Share**: Staff invites, Payment reminders via `Linking.openURL("whatsapp://send?...")`

### Offline
- Offline queue for sales (`syncQueuedSales` on app launch/foreground)
- Connectivity monitoring (`startConnectivityMonitoring`)
- OfflineBanner component in root layout

### Multi-entity Deletion Patterns
- **Long-press to delete**: Outlets, Tax Rates, Recurring Invoices, Scanned Documents
- **Edit icon → delete**: Price Lists, Brands, Categories, Referral Programs, Staff
- **Detail modal → delete**: Purchase History (via return), Estimates

### Confirmation Dialog Gaps (uses native Alert.alert instead of useConfirm)
- POS checkout confirmation
- Recurring Invoices delete
- Subscription plan change
- Scanned Documents delete
- Bill Scanner save/delete

### Swipe-to-Action Gaps
- No swipe-to-delete or swipe-to-archive patterns found on any screen
- All destructive actions require explicit button press or long-press

---

## API Endpoint Summary

| Method | Endpoint Pattern | Screens |
|--------|-----------------|---------|
| `GET` | `/products` | Inventory, Purchase Entry, Price Lists, Reorder, Stock Transfer, Sales Orders, Purchase Orders, Recurring Invoices |
| `GET` | `/parties` | Ledger, Purchase Entry, Purchase Orders, Sales Orders, Recurring Invoices |
| `GET/POST` | `/invoices` | POS, Invoice History, B2B |
| `GET/POST/PATCH/DELETE` | `/purchases` | Purchase Entry, Purchase History |
| `GET/POST/PATCH` | `/purchase-orders` | Purchase Orders |
| `GET/POST/PATCH` | `/sales-orders` | Sales Orders |
| `GET/POST/PATCH/DELETE` | `/brands`, `/categories` | Brands, Categories |
| `GET/POST/PATCH/DELETE` | `/staff` | Staff, Invite Staff |
| `GET/POST/PATCH/DELETE` | `/outlets` | Outlets |
| `GET/POST/PATCH/DELETE` | `/tax-rates` | Tax Rates |
| `GET/POST/PATCH/DELETE` | `/price-lists` | Price Lists |
| `GET/POST/PUT` | `/referral-programs` | Referral Program |
| `GET/POST/PATCH/DELETE` | `/stock-transfer-requests` | Stock Transfer Requests |
| `GET/POST/PATCH` | `/support-tickets` | Support Tickets |
| `GET` | `/reports/pnl`, `/reports/balance-sheet`, `/reports/aging`, `/reports/gst` | Reports |
| `GET` | `/ledger/unified/all` | Unified Ledger |
| `GET` | `/:kind/recycle-bin/list` | Recycle Bin (products/parties/invoices) |
| `POST` | `/:kind/:id/restore` | Recycle Bin |
| `GET/PATCH` | `/approval-queue` | Approval Queue |
| `GET` | `/activity-log` | Activity Log |
| `GET` | `/dashboard`, `/dashboard/summary` | Dashboard |
| `GET` | `/shifts/active`, `/shifts/outlet` | Shift Reconciliation |
| `POST` | `/shifts/start`, `/shifts/close` | Shift Reconciliation |
| `PATCH` | `/shifts/:id/reconcile` | Shift Reconciliation |
| `GET` | `/reminders/overdue` | Reminders |
| `POST` | `/reminders/:id/mark-sent` | Reminders |
| `GET` | `/plans`, `/companies/me`, `/companies/subscription` | Subscription Billing |
| `PATCH` | `/companies/subscription` | Subscription Billing |
| `PUT` | `/leave-management/shop-hours` | Shop Hours |
| `DELETE` | `/leave-management/shop-hours/:day` | Shop Hours |
| `GET/POST/PATCH/DELETE` | `/recurring-invoices` | Recurring Invoices |
| `GET/POST/PATCH/DELETE` | `/estimates` | Estimates |
| `POST` | `/estimates/:id/convert` | Estimates |
| `GET/POST` | `/credit-notes`, `/debit-notes` | Credit/Debit Notes |
| `GET/POST/PATCH/DELETE` | `/challans` | Challans |
| `GET/POST/PATCH/DELETE` | `/invoice-templates` | Invoice Templates |
| `GET/POST/PATCH/DELETE` | `/customer-groups` | Customer Groups |
| `GET/POST/PATCH/DELETE` | `/bank-accounts` | Bank Accounts |
| `GET/POST/PATCH/DELETE` | `/expenses` | Expenses |
| `GET/POST/PATCH` | `/attendance` | Attendance |
| `GET/PUT/POST` | `/payroll/settings`, `/payroll/calculate`, `/payroll/process` | Payroll |
| `GET/POST/PATCH` | `/leaves` | Leaves |
| `GET/POST/DELETE` | `/holidays` | Holidays |
| `GET/POST/PATCH/DELETE` | `/financial-years` | Financial Year |
| `GET/PATCH` | `/companies/me`, `/companies/onboarding` | Business Profile, Onboarding |
| `PATCH` | `/auth/change-password` | Account Security |
| `GET/PATCH` | `/notifications` | Notifications |
| `GET` | `/search` | Global Search |
| `POST` | `/products/bulk-update-prices` | Bulk Price Update |
| `GET` | `/daybook`, `/analytics` | Daybook, Analytics |
| `GET` | `/brands`, `/categories` | Brands, Categories |
| `GET` | `/gst-rate-tools` | GST Rate Tools |
| `GET` | `/live-activity` | Live Activity |
| `GET/PATCH` | `/modules` | Modules Settings |
| `GET` | `/agents` | Agents |
