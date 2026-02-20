import React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { IslandProvider } from "../src/context"
import { useIslandForm } from "../src/useIslandForm"
import { useIslandProps } from "../src/useIslandProps"
import { changeInput, click, renderReact, waitForExpectation } from "./domHarness"

const { islandFetchMock } = vi.hoisted(() => ({
  islandFetchMock: vi.fn()
}))

vi.mock("@archipelago/client", async () => {
  const actual = await vi.importActual<typeof import("../../client/src/index")>(
    "../../client/src/index"
  )

  return {
    ...actual,
    islandFetch: islandFetchMock
  }
})

describe("useIslandForm", () => {
  beforeEach(() => {
    islandFetchMock.mockReset()
  })

  it("submits and updates shared props state", async () => {
    islandFetchMock.mockResolvedValue({
      status: "ok",
      props: { members: [{ id: 1 }] },
      version: 5
    })

    function Probe() {
      const { props } = useIslandProps()
      const form = useIslandForm({
        initialData: { email: "" }
      })

      return (
        <>
          <div data-testid="members">{JSON.stringify(props.members ?? [])}</div>
          <input
            data-testid="email"
            value={form.data.email}
            onChange={(event) => form.setData("email", event.target.value)}
          />
          <button data-testid="submit" onClick={() => form.post("add_member")}>
            Submit
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }} stream="TeamMembers:1">
        <Probe />
      </IslandProvider>
    )

    await changeInput(view.getByTestId("email"), "new@example.com")
    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(islandFetchMock).toHaveBeenCalledTimes(1)
    })

    expect(islandFetchMock.mock.calls[0][0]).toBe("TeamMembers")
    expect(islandFetchMock.mock.calls[0][1]).toBe("add_member")
    expect(islandFetchMock.mock.calls[0][3].fixedParams).toEqual({
      team_id: 1,
      __stream: "TeamMembers:1"
    })

    await waitForExpectation(() => {
      expect(view.getByTestId("members").textContent).toContain('"id":1')
    })

    await view.unmount()
  })

  it("clears field errors when setData changes that field", async () => {
    islandFetchMock
      .mockResolvedValueOnce({
        status: "error",
        errors: { email: ["can't be blank"] }
      })
      .mockResolvedValueOnce({ status: "ok", props: {}, version: 2 })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        clearFieldErrorsOnChange: true
      })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="submit" onClick={() => form.post("add_member")}>
            Submit
          </button>
          <button data-testid="set-email" onClick={() => form.setData("email", "a@b.c")}>
            Set Email
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("email")
    })

    await click(view.getByTestId("set-email"))
    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toBe("{}")
    })

    await view.unmount()
  })

  it("sends _method override for put/patch/delete helpers", async () => {
    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "person@example.com" }
      })

      return (
        <button data-testid="submit" onClick={() => form.put("add_member")}>
          Submit
        </button>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(islandFetchMock).toHaveBeenCalledTimes(1)
    })

    expect(islandFetchMock.mock.calls[0][2]).toMatchObject({
      email: "person@example.com",
      _method: "put"
    })

    await view.unmount()
  })

  it("ignores stale response when a newer request wins", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    islandFetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({
        status: "ok",
        props: { members: [{ id: 2 }] },
        version: 2
      })

    function Probe() {
      const { props } = useIslandProps()
      const form = useIslandForm({ initialData: { email: "person@example.com" } })

      return (
        <>
          <div data-testid="members">{JSON.stringify(props.members ?? [])}</div>
          <button data-testid="submit-1" onClick={() => form.post("add_member")}>
            Submit 1
          </button>
          <button data-testid="submit-2" onClick={() => form.post("add_member")}>
            Submit 2
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("submit-1"))
    await click(view.getByTestId("submit-2"))

    await waitForExpectation(() => {
      expect(islandFetchMock).toHaveBeenCalledTimes(2)
    })

    resolveFirst?.({
      status: "ok",
      props: { members: [{ id: 1 }] },
      version: 1
    })

    await waitForExpectation(() => {
      expect(view.getByTestId("members").textContent).toContain("\"id\":2")
    })

    await view.unmount()
  })

  it("maps forbidden responses to a base form error", async () => {
    islandFetchMock.mockResolvedValue({
      status: "forbidden"
    })

    function Probe() {
      const form = useIslandForm({ initialData: { email: "" } })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="submit" onClick={() => form.post("forbidden")}>
            Submit
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain('"forbidden"')
    })

    await view.unmount()
  })

  it("resets form data and errors", async () => {
    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["is invalid"] }
    })

    function Probe() {
      const form = useIslandForm({ initialData: { email: "initial@example.com" } })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <input
            data-testid="email"
            value={form.data.email}
            onChange={(event) => form.setData("email", event.target.value)}
          />
          <button data-testid="submit" onClick={() => form.post("add_member")}>
            Submit
          </button>
          <button data-testid="reset" onClick={() => form.reset()}>
            Reset
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await changeInput(view.getByTestId("email"), "changed@example.com")
    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("email")
    })

    await click(view.getByTestId("reset"))

    await waitForExpectation(() => {
      expect((view.getByTestId("email") as HTMLInputElement).value).toBe("initial@example.com")
      expect(view.getByTestId("errors").textContent).toBe("{}")
    })

    await view.unmount()
  })
})
