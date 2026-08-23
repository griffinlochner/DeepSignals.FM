import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    // Playwright's fixture callback is named `use`, which the React Hooks rule misclassifies.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(pageErrors);
    expect(
      pageErrors,
      `Uncaught browser errors: ${pageErrors.join(" | ")}`,
    ).toEqual([]);
  },
});

export { expect };
