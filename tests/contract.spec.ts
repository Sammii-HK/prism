import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The behaviour contract, run against every expression.
 *
 * An expression may look and move however it likes. It may not change what
 * a control is to a screen reader, or what the keyboard does to it. These
 * tests drive the same product page in each expression with the keyboard
 * only and assert the same outcomes.
 */

const EXPRESSIONS = ["luminous", "reserved", "editorial"] as const;

const open = async (page: Page, expression: string) => {
  await page.goto(`/expressions?expression=${expression}&xray=0`);
  const product = page.getByRole("region", { name: /^Settings, drawn in/ });
  await expect(product).toBeVisible();
  return product;
};

/** aria-valuenow for custom sliders, the value for native ranges. */
const sliderValue = (slider: Locator) =>
  slider.evaluate((el) => Number(el.getAttribute("aria-valuenow") ?? (el as HTMLInputElement).value));

for (const expression of EXPRESSIONS) {
  test.describe(expression, () => {
    test("switch: role, name, Space toggles", async ({ page }) => {
      const product = await open(page, expression);
      const toggle = product.getByRole("switch", { name: "Daily digest" });
      await expect(toggle).toBeChecked();
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).not.toBeChecked();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked();
    });

    test("tabs: one tab stop, arrows select, Home and End jump", async ({ page }) => {
      const product = await open(page, expression);
      const tabs = product.getByRole("tab");
      await expect(tabs).toHaveCount(3);
      await expect(product.locator('[role=tab][tabindex="0"]')).toHaveCount(1);

      const first = product.getByRole("tab", { name: "Notifications" });
      await first.focus();
      await page.keyboard.press("ArrowRight");
      const privacy = product.getByRole("tab", { name: "Privacy" });
      await expect(privacy).toHaveAttribute("aria-selected", "true");
      await expect(privacy).toBeFocused();
      await expect(product.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", (await privacy.getAttribute("id"))!);

      await page.keyboard.press("End");
      await expect(product.getByRole("tab", { name: "Advanced" })).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Home");
      await expect(first).toHaveAttribute("aria-selected", "true");
      await expect(first).toBeFocused();
    });

    test("checkbox: role, name, Space toggles", async ({ page }) => {
      const product = await open(page, expression);
      await product.getByRole("tab", { name: "Privacy" }).click();
      const box = product.getByRole("checkbox", { name: /privacy terms/i });
      await expect(box).not.toBeChecked();
      await box.focus();
      await page.keyboard.press("Space");
      await expect(box).toBeChecked();
    });

    test("slider: arrows, Page Up, Home and End", async ({ page }) => {
      const product = await open(page, expression);
      const slider = product.getByRole("slider", { name: "Volume" });
      await slider.focus();
      expect(await sliderValue(slider)).toBe(64);
      await page.keyboard.press("ArrowRight");
      expect(await sliderValue(slider)).toBe(65);
      await page.keyboard.press("End");
      expect(await sliderValue(slider)).toBe(100);
      await page.keyboard.press("Home");
      expect(await sliderValue(slider)).toBe(0);
      await page.keyboard.press("PageUp");
      expect(await sliderValue(slider)).toBe(10);
    });

    test("select: labelled, and the keyboard picks a value", async ({ page }) => {
      const product = await open(page, expression);
      const select = product.getByRole("combobox", { name: "Send it" });
      await expect(select).toBeVisible();
      const native = await select.evaluate((el) => el.tagName === "SELECT");
      if (native) {
        // The platform owns a native select's keyboard behaviour; check it is a real, labelled one that works.
        await select.selectOption("weekly");
        await expect(select).toHaveValue("weekly");
        return;
      }
      await select.focus();
      await page.keyboard.press("Enter");
      await expect(select).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(select).toHaveAttribute("aria-expanded", "false");
      await expect(select).toContainText("Once a week");
      await expect(select).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await expect(select).toHaveAttribute("aria-expanded", "false");
      await expect(select).toBeFocused();
    });

    test("text field: labelled, and its error is announced", async ({ page }) => {
      const product = await open(page, expression);
      const email = product.getByLabel("Email");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(email).toHaveAccessibleDescription("Enter a full email address");
      await email.fill("sammii@example.com");
      await expect(email).not.toHaveAttribute("aria-invalid", "true");
    });

    test("tooltip: shows on focus, describes its trigger, Escape hides", async ({ page }) => {
      const product = await open(page, expression);
      const trigger = product.getByRole("button", { name: "About these settings" });
      await trigger.focus();
      const tip = page.getByRole("tooltip");
      await expect(tip).toBeVisible();
      await expect(trigger).toHaveAccessibleDescription("Changes apply to every device");
      await page.keyboard.press("Escape");
      await expect(tip).toBeHidden();
    });

    test("buttons are real buttons", async ({ page }) => {
      const product = await open(page, expression);
      const save = product.getByRole("button", { name: /save changes/i });
      expect(await save.evaluate((el) => el.tagName)).toBe("BUTTON");
    });
  });
}
