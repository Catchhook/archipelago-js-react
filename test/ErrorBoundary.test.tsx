import React from "react"
import { describe, expect, it, vi } from "vitest"

import { ErrorBoundary } from "../src/ErrorBoundary"
import { renderReact } from "./domHarness"

describe("ErrorBoundary", () => {
  it("renders fallback when an island crashes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    function Broken(): React.ReactElement {
      throw new Error("boom")
    }

    const view = await renderReact(
      <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
        <Broken />
      </ErrorBoundary>
    )

    expect(view.getByTestId("fallback").textContent).toBe("fallback")

    errorSpy.mockRestore()
    await view.unmount()
  })

  it("renders default fallback when none is provided", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    function Broken(): React.ReactElement {
      throw new Error("boom")
    }

    const view = await renderReact(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>
    )

    expect(view.container.querySelector("[data-archipelago-error='true']")?.textContent).toContain(
      "Island failed to render"
    )

    errorSpy.mockRestore()
    await view.unmount()
  })
})
