import { expect, test, type Page } from "@playwright/test";

/**
 * The overlay layer, driven the way people use it: keyboard first, then
 * pointer. These hold popover, menu, dialog, sheet and toast to the
 * behaviour their docs promise.
 */

const visit = async (page: Page, slug: string) => {
  await page.goto(`/${slug}?xray=0`);
  await page.waitForLoadState("networkidle");
};

const focusedName = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? "");

test.describe("menu", () => {
  test("keyboard: ArrowDown opens on the first item, keys move, Escape gives focus back", async ({ page }) => {
    await visit(page, "menu");
    const trigger = page.getByRole("button", { name: "Actions for Brand guidelines.pdf" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toHaveAccessibleName("Actions for Brand guidelines.pdf");
    await expect(page.getByRole("menuitem", { name: /Open/ })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /Rename/ })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: /Move to trash/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitem", { name: /Open/ })).toBeFocused();
    await page.keyboard.press("d");
    await expect(page.getByRole("menuitem", { name: /Duplicate/ })).toBeFocused();

    // The disabled item is skipped.
    await page.getByRole("menuitemcheckbox", { name: "Pin to top" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /Move to trash/ })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("ArrowUp opens on the last item", async ({ page }) => {
    await visit(page, "menu");
    await page.getByRole("button", { name: "Actions for Launch plan.md" }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: /Move to trash/ })).toBeFocused();
  });

  test("a check item stays open; an action closes and returns focus", async ({ page }) => {
    await visit(page, "menu");
    const trigger = page.getByRole("button", { name: "Actions for Launch plan.md" });
    await trigger.click();
    const pin = page.getByRole("menuitemcheckbox", { name: "Pin to top" });
    await expect(pin).toHaveAttribute("aria-checked", "false");
    await pin.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(pin).toHaveAttribute("aria-checked", "true");

    await page.getByRole("menuitem", { name: /Duplicate/ }).click();
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByText("Duplicated").first()).toBeVisible();
  });

  test("a click outside closes it without stealing focus back", async ({ page }) => {
    await visit(page, "menu");
    await page.getByRole("button", { name: "Actions for Launch plan.md" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByRole("menu")).toBeHidden();
  });
});

test.describe("popover", () => {
  test("focus moves in, Escape closes and gives it back", async ({ page }) => {
    await visit(page, "popover");
    const trigger = page.getByRole("button", { name: "Share" });
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Share" });
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel.getByRole("button", { name: "Copy" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  for (const strategy of ["CSS anchor() when available", "JavaScript always"]) {
    test(`escapes a clipped, transformed parent (${strategy})`, async ({ page }) => {
      await visit(page, "popover");
      await page.getByRole("button", { name: strategy }).click();
      const trigger = page.getByRole("button", { name: /^Filter/ });
      await trigger.click();
      const panel = page.getByRole("dialog", { name: "Filter by tag" });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS("opacity", "1");
      const inTopLayer = await panel.evaluate((el) => el.matches(":popover-open"));
      expect(inTopLayer).toBe(true);
      const [t, p] = [await trigger.boundingBox(), await panel.boundingBox()];
      expect(t && p).toBeTruthy();
      // Under the trigger, right edges aligned, and taller than the card's remaining room (so it was not clipped).
      expect(p!.y).toBeGreaterThan(t!.y + t!.height);
      expect(Math.abs(p!.x + p!.width - (t!.x + t!.width))).toBeLessThan(12);
      const card = await page.locator(".h-40.overflow-hidden").boundingBox();
      expect(p!.y + p!.height).toBeGreaterThan(card!.y + card!.height);
      // The checkboxes inside are reachable with the pointer.
      await page.getByRole("checkbox", { name: "Research" }).click();
      await expect(trigger).toHaveText(/Filter \(2\)/);
    });
  }
});

test.describe("dialog", () => {
  test("modal: inert page, focus in, nested Escape, focus back", async ({ page }) => {
    await visit(page, "dialog");
    const opener = page.getByRole("button", { name: "Edit profile" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription("This is how you appear on shared projects.");
    expect(await page.locator("dialog").evaluate((el) => el.matches(":modal"))).toBe(true);
    // Focus is inside, on the first field.
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
    // The rest of the page is inert: a button behind it cannot take focus.
    const behind = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete project")!;
      button.focus();
      return document.activeElement === button;
    });
    expect(behind).toBe(false);

    await page.getByRole("button", { name: "Public" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a backdrop press closes a dialog but not an alertdialog", async ({ page }) => {
    await visit(page, "dialog");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Delete project" }).click();
    const alert = page.getByRole("alertdialog", { name: "Delete this project?" });
    await expect(alert).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.mouse.click(8, 8);
    await expect(alert).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(alert).toBeHidden();
  });

  test("the page behind does not scroll", async ({ page }) => {
    await visit(page, "dialog");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
  });
});

test.describe("sheet", () => {
  const handleOf = (page: Page) => page.locator("dialog .cursor-grab").first();

  test("drag past a third closes it; a short drag settles back", async ({ page }) => {
    await visit(page, "sheet");
    await page.getByRole("button", { name: "Notification settings" }).click();
    const sheet = page.getByRole("dialog", { name: "Notifications" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(500);

    const box = (await handleOf(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // Short and slow: it comes back.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(x + i * 4, y);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(700);
    await expect(sheet).toBeVisible();
    const settled = await page.locator("dialog .fixed.flex").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    expect(Math.abs(settled)).toBeLessThan(1);

    // Far: it closes.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(x + i * 20, y);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Notification settings" })).toBeFocused();
  });

  test("bottom sheet opens from the bottom edge and closes on Escape", async ({ page }) => {
    await visit(page, "sheet");
    await page.getByRole("button", { name: "Share sheet" }).click();
    const sheet = page.getByRole("dialog", { name: /Share/ });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(500);
    const panel = (await page.locator("dialog .fixed.flex").boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(panel.y + panel.height)).toBe(viewport.height);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});

test.describe("toast", () => {
  const watchFor = (page: Page, text: string) =>
    page.evaluate((needle) => {
      const w = window as unknown as { __seen: boolean };
      w.__seen = false;
      // Only the toasts themselves; the docs on the page quote the same strings.
      const region = document.querySelector("section[popover]")!;
      new MutationObserver(() => {
        if (region.textContent?.includes(needle)) w.__seen = true;
      }).observe(region, { subtree: true, childList: true, characterData: true });
    }, text);
  const seen = (page: Page) => page.evaluate(() => (window as unknown as { __seen: boolean }).__seen);

  test("a fast request never flashes a loading toast; a slow one does", async ({ page }) => {
    await visit(page, "toast");
    await watchFor(page, "Saving…");
    await page.getByRole("button", { name: "Save, fast server" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Saved" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await seen(page)).toBe(false);

    await page.getByRole("button", { name: "Save, slow server" }).click();
    const toasts = page.getByRole("region", { name: /Notifications/ });
    await expect(toasts.getByText("Saving…")).toBeVisible();
    // The same toast turns into "Saved" in place.
    await expect(toasts.getByText("Saving…")).toBeHidden({ timeout: 4000 });
    await expect(toasts.getByText("Saved")).toHaveCount(2);
  });

  test("announced through a live region; the action works", async ({ page }) => {
    await visit(page, "toast");
    await page.getByRole("button", { name: "Archive, with undo" }).click();
    await expect(page.getByRole("status")).toHaveText("Moved 3 items to archive");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Restored 3 items");
  });

  test("errors are announced assertively, and F8 reaches the toasts", async ({ page }) => {
    await visit(page, "toast");
    await page.getByRole("button", { name: "Fail, with retry" }).click();
    await expect(page.locator('[role="alert"][aria-live="assertive"].sr-only')).toHaveText("Message not sent. You are offline.");
    await page.keyboard.press("F8");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SECTION");
    await page.keyboard.press("Tab");
    expect(await focusedName(page)).toBe("Retry");
  });

  test("hovering pauses the timer", async ({ page }) => {
    await visit(page, "toast");
    await page.getByRole("button", { name: "Save, fast server" }).click();
    const item = page.getByRole("listitem").filter({ hasText: "Saved" });
    await expect(item).toBeVisible();
    await item.hover();
    await page.waitForTimeout(4800); // success toasts last 4s
    await expect(item).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(item).toBeHidden({ timeout: 6000 });
  });
});
