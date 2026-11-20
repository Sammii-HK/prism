import { expect, test, type Page } from "@playwright/test";

/**
 * The AI response, driven through real recorded runs. Replays are sped up
 * with ?speed= so the suite is quick; the states and their order are the
 * recording's own.
 */

const open = async (page: Page, speed: number) => {
  await page.goto(`/ai-response?xray=0&speed=${speed}`);
  await page.waitForLoadState("networkidle");
};
const response = (page: Page) => page.getByRole("article", { name: "Prism assistant response" });
const ask = (page: Page, label: string) => page.getByRole("button", { name: label }).click();

test("a full answer: steps, cited sources, and one announcement at the end", async ({ page }) => {
  await open(page, 20);
  await ask(page, "Picks a component, with sources");
  const r = response(page);
  await expect(r.getByRole("button", { name: /Searched components for/ })).toBeVisible();
  await expect(r.getByRole("button", { name: /Opened dialog/ })).toBeVisible();
  await expect(r.getByRole("button", { name: "Regenerate" })).toBeVisible({ timeout: 10_000 });
  const cite = r.getByRole("link", { name: "Source 1: Dialog" });
  await expect(cite).toHaveAttribute("href", "/dialog");
  await expect(r.getByRole("link", { name: "Dialog", exact: true })).toBeVisible();
  await expect(r.getByRole("status")).toContainText("Prism assistant answered:");
  await expect(r).toHaveAttribute("aria-busy", "false");
});

test("nothing is drawn inside the quiet window, then it says it is thinking", async ({ page }) => {
  await open(page, 4);
  // Measured in the page, so a slow test runner cannot blur the 400ms window.
  await page.evaluate(() => {
    const w = window as unknown as { __clickAt: number; __thinkingAt: number };
    w.__thinkingAt = 0;
    document.addEventListener("click", () => (w.__clickAt = performance.now()), { capture: true, once: true });
    new MutationObserver(() => {
      if (!w.__thinkingAt && document.querySelector("article")?.textContent?.includes("Thinking")) w.__thinkingAt = performance.now();
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await ask(page, "Picks a component, with sources");
  await expect(response(page).getByText("Thinking")).toBeVisible({ timeout: 2_000 });
  const gap = await page.evaluate(() => {
    const w = window as unknown as { __clickAt: number; __thinkingAt: number };
    return w.__thinkingAt - w.__clickAt;
  });
  expect(gap).toBeGreaterThanOrEqual(380);
});

test("a long silence says so, with the time and a Stop", async ({ page }) => {
  await open(page, 1.5);
  await ask(page, "A slow answer");
  await expect(response(page).getByText(/Still working · \d+s/)).toBeVisible({ timeout: 10_000 });
  await expect(response(page).getByRole("button", { name: "Stop" })).toBeVisible();
});

test("Stop keeps what arrived and offers Retry; Escape stops too", async ({ page }) => {
  await open(page, 6);
  await ask(page, "A slow answer");
  const r = response(page);
  await expect(r.locator("p").first()).toContainText(/\w+/, { timeout: 15_000 });
  await r.getByRole("button", { name: "Stop" }).click();
  await expect(r.getByText("Stopped", { exact: true })).toBeVisible();
  await page.waitForTimeout(100);
  const kept = await r.locator("p").allInnerTexts();
  await page.waitForTimeout(800);
  expect(await r.locator("p").allInnerTexts()).toEqual(kept);
  await expect(r.getByRole("button", { name: "Retry" })).toBeVisible();

  await r.getByRole("button", { name: "Retry" }).click();
  await expect(r.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(r.getByText("Stopped", { exact: true })).toBeVisible();
});

test("a tool times out; Retry plays the second real attempt", async ({ page }) => {
  await open(page, 20);
  await ask(page, "A tool times out");
  const r = response(page);
  await expect(r.getByRole("button", { name: /Opened popover · Timed out/ })).toBeVisible({ timeout: 10_000 });
  await expect(r.getByRole("button", { name: "Regenerate" })).toBeVisible({ timeout: 10_000 });
  await r.getByRole("button", { name: "Regenerate" }).click();
  await expect(r.getByRole("link", { name: "Source 4: Popover" })).toHaveAttribute("href", "/popover", { timeout: 10_000 });
});

test("the wrong-source run is shown as it happened: the citation gives it away", async ({ page }) => {
  await open(page, 20);
  await ask(page, "The model reads the wrong component");
  await expect(response(page).getByRole("link", { name: "Source 2: Radial menu" })).toHaveAttribute("href", "/radial-menu", { timeout: 10_000 });
  await expect(page.getByText(/opened Radial menu instead/)).toBeVisible();
});

test("a dropped connection keeps the partial answer and Retry completes it", async ({ page }) => {
  await open(page, 20);
  await ask(page, "The connection drops");
  const r = response(page);
  await expect(r.getByText("The connection dropped.", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(r.getByRole("status")).toContainText("failed");
  await expect(page.getByText(/The drop is simulated in the replay/)).toBeVisible();
  await r.getByRole("button", { name: "Retry" }).click();
  await expect(r.getByRole("button", { name: "Regenerate" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/The drop is simulated in the replay/)).toHaveCount(0);
});
