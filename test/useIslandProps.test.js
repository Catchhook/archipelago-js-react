import { jsx as _jsx } from "react/jsx-runtime";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { IslandProvider } from "../src/context";
import { useIslandProps } from "../src/useIslandProps";
import { renderReact } from "./domHarness";
function buildConsumer() {
    const callbacks = [];
    return {
        consumer: {
            subscriptions: {
                create: (_params, handlers) => {
                    callbacks.push(handlers.received ?? (() => undefined));
                    return {
                        unsubscribe: vi.fn()
                    };
                }
            }
        },
        push(payload) {
            callbacks.forEach((handler) => handler(payload));
        }
    };
}
describe("useIslandProps", () => {
    it("replaces props on stream updates with newer versions", async () => {
        const cable = buildConsumer();
        function Probe() {
            const { props } = useIslandProps({ consumer: cable.consumer });
            return _jsx("div", { "data-testid": "value", children: String(props.count) });
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, stream: "TeamMembers:1", initialProps: { count: 1 }, initialVersion: 1, children: _jsx(Probe, {}) }));
        expect(view.getByTestId("value").textContent).toBe("1");
        await act(async () => {
            cable.push({ status: "ok", props: { count: 2 }, version: 2 });
        });
        expect(view.getByTestId("value").textContent).toBe("2");
        await act(async () => {
            cable.push({ status: "ok", props: { count: 3 }, version: 2 });
        });
        expect(view.getByTestId("value").textContent).toBe("2");
        await view.unmount();
    });
    it("uses custom onLiveProps reconciliation when provided", async () => {
        const cable = buildConsumer();
        function Probe() {
            const { props } = useIslandProps({
                consumer: cable.consumer,
                onLiveProps: (next, previous) => ({
                    ...previous,
                    ...next,
                    touched: true
                })
            });
            return _jsx("div", { "data-testid": "value", children: JSON.stringify(props) });
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, stream: "TeamMembers:1", initialProps: { count: 1 }, initialVersion: 1, children: _jsx(Probe, {}) }));
        await act(async () => {
            cable.push({ status: "ok", props: { count: 4 }, version: 10 });
        });
        expect(view.getByTestId("value").textContent).toContain('"count":4');
        expect(view.getByTestId("value").textContent).toContain('"touched":true');
        await view.unmount();
    });
    it("ignores non-ok stream payloads", async () => {
        const cable = buildConsumer();
        function Probe() {
            const { props } = useIslandProps({ consumer: cable.consumer });
            return _jsx("div", { "data-testid": "value", children: String(props.count) });
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, stream: "TeamMembers:1", initialProps: { count: 1 }, initialVersion: 1, children: _jsx(Probe, {}) }));
        await act(async () => {
            cable.push({ status: "error", errors: { base: ["bad"] } });
            cable.push({ nope: true });
        });
        expect(view.getByTestId("value").textContent).toBe("1");
        await view.unmount();
    });
});
//# sourceMappingURL=useIslandProps.test.js.map