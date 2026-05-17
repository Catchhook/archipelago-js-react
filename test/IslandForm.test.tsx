import React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { IslandProvider } from "../src/context"
import { IslandForm } from "../src/IslandForm"
import { renderReact, waitForExpectation } from "./domHarness"
import { act } from "react"

const { islandFetchMock } = vi.hoisted(() => ({
  islandFetchMock: vi.fn()
}))

vi.mock("@archipelago-js/client", async () => {
  const actual = await vi.importActual<typeof import("../../client/src/index")>(
    "../../client/src/index"
  )

  return {
    ...actual,
    islandFetch: islandFetchMock
  }
})

describe("IslandForm", () => {
  beforeEach(() => {
    islandFetchMock.mockReset()
  })

  it("submits uncontrolled form data via FormData serialization", async () => {
    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <IslandForm operation="save" method="post">
          <input name="email" defaultValue="test@example.com" />
          <button type="submit" data-testid="submit">
            Save
          </button>
        </IslandForm>
      </IslandProvider>
    )

    const form = view.container.querySelector("form")!
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    await waitForExpectation(() => {
      expect(islandFetchMock).toHaveBeenCalledTimes(1)
    })

    const callOptions = islandFetchMock.mock.calls[0][3]
    expect(callOptions.overridePayload).toMatchObject({ email: "test@example.com" })

    await view.unmount()
  })

  it("exposes form state via render-prop children", async () => {
    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["is invalid"] }
    })

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <IslandForm operation="save" method="post">
          {(form) => (
            <>
              <div data-testid="errors">{JSON.stringify(form.errors)}</div>
              <div data-testid="processing">{String(form.processing)}</div>
              <input name="email" defaultValue="bad" />
              <button type="submit" data-testid="submit">
                Save
              </button>
            </>
          )}
        </IslandForm>
      </IslandProvider>
    )

    const form = view.container.querySelector("form")!
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("email")
      expect(view.getByTestId("processing").textContent).toBe("false")
    })

    await view.unmount()
  })

  it("calls onSuccess callback on ok response", async () => {
    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })
    const onSuccess = vi.fn()

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <IslandForm operation="save" method="post" onSuccess={onSuccess}>
          <input name="email" defaultValue="a@b.c" />
          <button type="submit" data-testid="submit">
            Save
          </button>
        </IslandForm>
      </IslandProvider>
    )

    const form = view.container.querySelector("form")!
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    await waitForExpectation(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    await view.unmount()
  })

  it("passes className to the form element", async () => {
    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <IslandForm operation="save" method="post" className="my-form">
          <button type="submit">Save</button>
        </IslandForm>
      </IslandProvider>
    )

    const form = view.container.querySelector("form")!
    expect(form.className).toBe("my-form")

    await view.unmount()
  })
})
