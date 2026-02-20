import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { renderReact } from "./domHarness";
describe("ErrorBoundary", () => {
    it("renders fallback when an island crashes", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        function Broken() {
            throw new Error("boom");
        }
        const view = await renderReact(_jsx(ErrorBoundary, { fallback: _jsx("div", { "data-testid": "fallback", children: "fallback" }), children: _jsx(Broken, {}) }));
        expect(view.getByTestId("fallback").textContent).toBe("fallback");
        errorSpy.mockRestore();
        await view.unmount();
    });
});
//# sourceMappingURL=ErrorBoundary.test.js.map