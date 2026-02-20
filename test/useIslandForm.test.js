import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IslandProvider } from "../src/context";
import { useIslandForm } from "../src/useIslandForm";
import { useIslandProps } from "../src/useIslandProps";
import { changeInput, click, renderReact, waitForExpectation } from "./domHarness";
const { islandFetchMock } = vi.hoisted(() => ({
    islandFetchMock: vi.fn()
}));
vi.mock("@archipelago/client", async () => {
    const actual = await vi.importActual("../../client/src/index");
    return {
        ...actual,
        islandFetch: islandFetchMock
    };
});
describe("useIslandForm", () => {
    beforeEach(() => {
        islandFetchMock.mockReset();
    });
    it("submits and updates shared props state", async () => {
        islandFetchMock.mockResolvedValue({
            status: "ok",
            props: { members: [{ id: 1 }] },
            version: 5
        });
        function Probe() {
            const { props } = useIslandProps();
            const form = useIslandForm({
                initialData: { email: "" }
            });
            return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "members", children: JSON.stringify(props.members ?? []) }), _jsx("input", { "data-testid": "email", value: form.data.email, onChange: (event) => form.setData("email", event.target.value) }), _jsx("button", { "data-testid": "submit", onClick: () => form.post("add_member"), children: "Submit" })] }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, stream: "TeamMembers:1", children: _jsx(Probe, {}) }));
        await changeInput(view.getByTestId("email"), "new@example.com");
        await click(view.getByTestId("submit"));
        await waitForExpectation(() => {
            expect(islandFetchMock).toHaveBeenCalledTimes(1);
        });
        expect(islandFetchMock.mock.calls[0][0]).toBe("TeamMembers");
        expect(islandFetchMock.mock.calls[0][1]).toBe("add_member");
        expect(islandFetchMock.mock.calls[0][3].fixedParams).toEqual({
            team_id: 1,
            __stream: "TeamMembers:1"
        });
        await waitForExpectation(() => {
            expect(view.getByTestId("members").textContent).toContain('"id":1');
        });
        await view.unmount();
    });
    it("clears field errors when setData changes that field", async () => {
        islandFetchMock
            .mockResolvedValueOnce({
            status: "error",
            errors: { email: ["can't be blank"] }
        })
            .mockResolvedValueOnce({ status: "ok", props: {}, version: 2 });
        function Probe() {
            const form = useIslandForm({
                initialData: { email: "" },
                clearFieldErrorsOnChange: true
            });
            return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "errors", children: JSON.stringify(form.errors) }), _jsx("button", { "data-testid": "submit", onClick: () => form.post("add_member"), children: "Submit" }), _jsx("button", { "data-testid": "set-email", onClick: () => form.setData("email", "a@b.c"), children: "Set Email" })] }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, children: _jsx(Probe, {}) }));
        await click(view.getByTestId("submit"));
        await waitForExpectation(() => {
            expect(view.getByTestId("errors").textContent).toContain("email");
        });
        await click(view.getByTestId("set-email"));
        await waitForExpectation(() => {
            expect(view.getByTestId("errors").textContent).toBe("{}");
        });
        await view.unmount();
    });
    it("sends _method override for put/patch/delete helpers", async () => {
        islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 });
        function Probe() {
            const form = useIslandForm({
                initialData: { email: "person@example.com" }
            });
            return (_jsx("button", { "data-testid": "submit", onClick: () => form.put("add_member"), children: "Submit" }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, children: _jsx(Probe, {}) }));
        await click(view.getByTestId("submit"));
        await waitForExpectation(() => {
            expect(islandFetchMock).toHaveBeenCalledTimes(1);
        });
        expect(islandFetchMock.mock.calls[0][2]).toMatchObject({
            email: "person@example.com",
            _method: "put"
        });
        await view.unmount();
    });
    it("ignores stale response when a newer request wins", async () => {
        let resolveFirst;
        islandFetchMock
            .mockImplementationOnce(() => new Promise((resolve) => {
            resolveFirst = resolve;
        }))
            .mockResolvedValueOnce({
            status: "ok",
            props: { members: [{ id: 2 }] },
            version: 2
        });
        function Probe() {
            const { props } = useIslandProps();
            const form = useIslandForm({ initialData: { email: "person@example.com" } });
            return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "members", children: JSON.stringify(props.members ?? []) }), _jsx("button", { "data-testid": "submit-1", onClick: () => form.post("add_member"), children: "Submit 1" }), _jsx("button", { "data-testid": "submit-2", onClick: () => form.post("add_member"), children: "Submit 2" })] }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, children: _jsx(Probe, {}) }));
        await click(view.getByTestId("submit-1"));
        await click(view.getByTestId("submit-2"));
        await waitForExpectation(() => {
            expect(islandFetchMock).toHaveBeenCalledTimes(2);
        });
        resolveFirst?.({
            status: "ok",
            props: { members: [{ id: 1 }] },
            version: 1
        });
        await waitForExpectation(() => {
            expect(view.getByTestId("members").textContent).toContain("\"id\":2");
        });
        await view.unmount();
    });
    it("maps forbidden responses to a base form error", async () => {
        islandFetchMock.mockResolvedValue({
            status: "forbidden"
        });
        function Probe() {
            const form = useIslandForm({ initialData: { email: "" } });
            return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "errors", children: JSON.stringify(form.errors) }), _jsx("button", { "data-testid": "submit", onClick: () => form.post("forbidden"), children: "Submit" })] }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, children: _jsx(Probe, {}) }));
        await click(view.getByTestId("submit"));
        await waitForExpectation(() => {
            expect(view.getByTestId("errors").textContent).toContain('"forbidden"');
        });
        await view.unmount();
    });
    it("resets form data and errors", async () => {
        islandFetchMock.mockResolvedValue({
            status: "error",
            errors: { email: ["is invalid"] }
        });
        function Probe() {
            const form = useIslandForm({ initialData: { email: "initial@example.com" } });
            return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "errors", children: JSON.stringify(form.errors) }), _jsx("input", { "data-testid": "email", value: form.data.email, onChange: (event) => form.setData("email", event.target.value) }), _jsx("button", { "data-testid": "submit", onClick: () => form.post("add_member"), children: "Submit" }), _jsx("button", { "data-testid": "reset", onClick: () => form.reset(), children: "Reset" })] }));
        }
        const view = await renderReact(_jsx(IslandProvider, { component: "TeamMembers", params: { team_id: 1 }, children: _jsx(Probe, {}) }));
        await changeInput(view.getByTestId("email"), "changed@example.com");
        await click(view.getByTestId("submit"));
        await waitForExpectation(() => {
            expect(view.getByTestId("errors").textContent).toContain("email");
        });
        await click(view.getByTestId("reset"));
        await waitForExpectation(() => {
            expect(view.getByTestId("email").value).toBe("initial@example.com");
            expect(view.getByTestId("errors").textContent).toBe("{}");
        });
        await view.unmount();
    });
});
//# sourceMappingURL=useIslandForm.test.js.map