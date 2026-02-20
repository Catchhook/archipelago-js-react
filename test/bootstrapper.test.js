import { jsx as _jsx } from "react/jsx-runtime";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootArchipelagoIslands, defineIslandLoader, unmountArchipelagoIslands } from "../src/bootstrapper";
function flush() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}
async function boot(registry) {
    await act(async () => {
        await bootArchipelagoIslands(registry);
    });
    await flush();
}
describe("bootArchipelagoIslands", () => {
    afterEach(async () => {
        await act(async () => {
            unmountArchipelagoIslands();
        });
        document.body.innerHTML = "";
    });
    it("mounts islands and skips already-mounted nodes", async () => {
        const renderSpy = vi.fn();
        function TeamMembers() {
            renderSpy();
            return _jsx("div", { "data-testid": "island", children: "mounted" });
        }
        document.body.innerHTML = `
      <div
        data-island="true"
        data-component="TeamMembers"
        data-props='{"members":[]}'
        data-params='{"team_id":1}'
      ></div>
    `;
        await boot({ TeamMembers });
        expect(document.body.textContent).toContain("mounted");
        expect(renderSpy).toHaveBeenCalledTimes(1);
        await boot({ TeamMembers });
        expect(renderSpy).toHaveBeenCalledTimes(1);
    });
    it("supports async registry entries", async () => {
        function TeamMembers() {
            return _jsx("div", { children: "async-mounted" });
        }
        document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `;
        await boot({
            TeamMembers: defineIslandLoader(async () => ({ default: TeamMembers }))
        });
        expect(document.body.textContent).toContain("async-mounted");
    });
    it("mounts new islands on turbo:load", async () => {
        function TeamMembers() {
            return _jsx("div", { children: "live-mount" });
        }
        document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `;
        await boot({ TeamMembers });
        const next = document.createElement("div");
        next.setAttribute("data-island", "true");
        next.setAttribute("data-component", "TeamMembers");
        next.setAttribute("data-props", "{}");
        next.setAttribute("data-params", "{}");
        document.body.appendChild(next);
        await act(async () => {
            document.dispatchEvent(new Event("turbo:load"));
        });
        await flush();
        const matches = Array.from(document.body.querySelectorAll("[data-mounted='true']"));
        expect(matches).toHaveLength(2);
    });
    it("unmounts on turbo:before-cache", async () => {
        function TeamMembers() {
            return _jsx("div", { children: "cache-target" });
        }
        document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `;
        await boot({ TeamMembers });
        expect(document.body.textContent).toContain("cache-target");
        await act(async () => {
            document.dispatchEvent(new Event("turbo:before-cache"));
        });
        await flush();
        expect(document.body.textContent).not.toContain("cache-target");
        await act(async () => {
            unmountArchipelagoIslands();
        });
    });
});
//# sourceMappingURL=bootstrapper.test.js.map