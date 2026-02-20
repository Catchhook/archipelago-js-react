import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { act } from "react";
import { createRoot } from "react-dom/client";
export async function renderReact(node) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(_jsx(_Fragment, { children: node }));
    });
    return {
        container,
        getByTestId: (id) => {
            const element = container.querySelector(`[data-testid="${id}"]`);
            if (!element) {
                throw new Error(`Missing element with data-testid=${id}`);
            }
            return element;
        },
        unmount: async () => {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    };
}
export async function click(element) {
    await act(async () => {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}
export async function changeInput(element, value) {
    await act(async () => {
        ;
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
    });
}
export async function waitForExpectation(assertion, options = {}) {
    const timeoutMs = options.timeoutMs ?? 1000;
    const intervalMs = options.intervalMs ?? 10;
    const startedAt = Date.now();
    while (true) {
        try {
            assertion();
            return;
        }
        catch (error) {
            if (Date.now() - startedAt >= timeoutMs) {
                throw error;
            }
            await new Promise((resolve) => {
                setTimeout(resolve, intervalMs);
            });
        }
    }
}
//# sourceMappingURL=domHarness.js.map