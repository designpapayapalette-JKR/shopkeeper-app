/**
 * E2E: Mobile app auth flow — login, logout, PIN setup.
 * Uses Detox for React Native E2E testing.
 * 
 * Prerequisites:
 *   detox build --configuration android
 *   detox test --configuration android
 */

import { by, device, element, expect, waitFor } from "detox";

describe("Auth Flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it("should show login screen on launch", async () => {
    await expect(element(by.id("login-email-input"))).toBeVisible();
    await expect(element(by.id("login-password-input"))).toBeVisible();
    await expect(element(by.id("login-submit-button"))).toBeVisible();
  });

  it("should show validation error on empty submit", async () => {
    await element(by.id("login-submit-button")).tap();
    await expect(element(by.text("Email is required"))).toBeVisible();
  });

  it("should show error on invalid credentials", async () => {
    await element(by.id("login-email-input")).typeText("invalid@example.com");
    await element(by.id("login-password-input")).typeText("wrongpassword");
    await element(by.id("login-submit-button")).tap();
    await expect(element(by.text("Invalid credentials"))).toBeVisible();
  });

  it("should navigate to dashboard on successful login", async () => {
    await element(by.id("login-email-input")).typeText("e2e@example.com");
    await element(by.id("login-password-input")).typeText("TestPass123!");
    await element(by.id("login-submit-button")).tap();
    await waitFor(element(by.id("dashboard-screen")))
      .toBeVisible()
      .withTimeout(10000);
  });

  it("should show tab bar with Home and Me tabs", async () => {
    await element(by.id("login-email-input")).typeText("e2e@example.com");
    await element(by.id("login-password-input")).typeText("TestPass123!");
    await element(by.id("login-submit-button")).tap();
    await waitFor(element(by.id("home-tab"))).toBeVisible().withTimeout(10000);
    await expect(element(by.id("profile-tab"))).toBeVisible();
  });
});

describe("Dashboard", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await element(by.id("login-email-input")).typeText("e2e@example.com");
    await element(by.id("login-password-input")).typeText("TestPass123!");
    await element(by.id("login-submit-button")).tap();
    await waitFor(element(by.id("dashboard-screen"))).toBeVisible().withTimeout(10000);
  });

  it("should display KPI tiles", async () => {
    await expect(element(by.id("kpi-sales-today"))).toBeVisible();
    await expect(element(by.id("kpi-invoices-today"))).toBeVisible();
  });

  it("should navigate to POS on tap", async () => {
    await element(by.id("pos-tab")).tap();
    await expect(element(by.id("pos-screen"))).toBeVisible();
  });
});

describe("Offline Banner", () => {
  it("should show banner when offline", async () => {
    await device.setStatusBar({ connected: false });
    await expect(element(by.id("offline-banner"))).toBeVisible();
    await device.setStatusBar({ connected: true });
  });
});
