import { router } from "expo-router";

// Maps notification types to their target routes. When a user taps a
// notification, the `data.type` field determines where they land.
// Add new notification types here rather than scattering switch/case
// blocks across screens.
const NOTIFICATION_ROUTES: Record<string, (data: Record<string, unknown>) => string> = {
  new_order: () => "/invoice-history",
  payment_received: (data) => `/ledger/${data.partyId}`,
  low_stock: () => "/inventory",
  overdue_reminder: () => "/ledger",
  attendance_alert: () => "/attendance",
  leave_request: () => "/staff",
  approval_needed: () => "/approval-queue",
  shift_unreconciled: () => "/shift-reconciliation",
  sale: () => "/invoice-history",
  expense_approved: () => "/expenses",
  task_assigned: () => "/tasks",
};

export function handleNotificationDeepLink(data: Record<string, unknown>): void {
  const type = (data.type as string) || "";
  const routeBuilder = NOTIFICATION_ROUTES[type];
  if (routeBuilder) {
    const route = routeBuilder(data);
    router.push(route as any);
  } else {
    // Fallback: go to notifications list
    router.push("/notifications" as any);
  }
}
