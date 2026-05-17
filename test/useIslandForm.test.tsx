import React from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { IslandProvider } from "../src/context"
import { useIslandForm } from "../src/useIslandForm"
import { useIslandProps } from "../src/useIslandProps"
import { changeInput, click, renderReact, waitForExpectation } from "./domHarness"

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
      team_id: 1
    })
    expect(islandFetchMock.mock.calls[0][3].stream).toBe("TeamMembers:1")

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

  it("keeps field errors when clearFieldErrorsOnChange is false", async () => {
    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["can't be blank"] }
    })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        clearFieldErrorsOnChange: false
      })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="submit" onClick={() => form.post("add_member")}>
            Submit
          </button>
          <button data-testid="set-email" onClick={() => form.setData("email", "changed@example.com")}>
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
      expect(view.getByTestId("errors").textContent).toContain("email")
    })

    await view.unmount()
  })

  it("aborts the previous request when a new submit starts", async () => {
    islandFetchMock.mockImplementation(async () => {
      return new Promise(() => undefined)
    })

    function Probe() {
      const form = useIslandForm({ initialData: { email: "person@example.com" } })

      return (
        <>
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

    const firstSignal = islandFetchMock.mock.calls[0][3].signal as AbortSignal
    const secondSignal = islandFetchMock.mock.calls[1][3].signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)

    await view.unmount()
  })

  it("captures non-abort errors into transportError", async () => {
    islandFetchMock.mockRejectedValue(new Error("network-down"))

    function Probe() {
      const form = useIslandForm({ initialData: { email: "person@example.com" } })

      return (
        <>
          <div data-testid="transport-error">{form.transportError?.message ?? ""}</div>
          <div data-testid="processing">{String(form.processing)}</div>
          <button
            data-testid="submit"
            onClick={() => form.post("add_member")}
          >
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
      expect(view.getByTestId("transport-error").textContent).toBe("network-down")
      expect(view.getByTestId("processing").textContent).toBe("false")
    })

    await view.unmount()
  })

  it("sets wasSuccessful and recentlySuccessful on ok response", async () => {
    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        recentlySuccessfulDuration: 50
      })

      return (
        <>
          <div data-testid="was-successful">{String(form.wasSuccessful)}</div>
          <div data-testid="recently-successful">{String(form.recentlySuccessful)}</div>
          <button data-testid="submit" onClick={() => form.post("save")}>
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

    expect(view.getByTestId("was-successful").textContent).toBe("false")
    expect(view.getByTestId("recently-successful").textContent).toBe("false")

    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(view.getByTestId("was-successful").textContent).toBe("true")
      expect(view.getByTestId("recently-successful").textContent).toBe("true")
    })

    await waitForExpectation(
      () => {
        expect(view.getByTestId("recently-successful").textContent).toBe("false")
      },
      { timeoutMs: 200 }
    )
    expect(view.getByTestId("was-successful").textContent).toBe("true")

    await view.unmount()
  })

  it("sets wasSuccessful on redirect response", async () => {
    islandFetchMock.mockResolvedValue({ status: "redirect", location: "/done" })

    function Probe() {
      const form = useIslandForm({ initialData: { email: "" } })

      return (
        <>
          <div data-testid="was-successful">{String(form.wasSuccessful)}</div>
          <button data-testid="submit" onClick={() => form.post("save")}>
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
      expect(view.getByTestId("was-successful").textContent).toBe("true")
    })

    await view.unmount()
  })

  it("clearErrors clears all errors", async () => {
    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["invalid"], name: ["required"] }
    })

    function Probe() {
      const form = useIslandForm({ initialData: { email: "", name: "" } })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="submit" onClick={() => form.post("save")}>
            Submit
          </button>
          <button data-testid="clear-all" onClick={() => form.clearErrors()}>
            Clear All
          </button>
          <button data-testid="clear-email" onClick={() => form.clearErrors("email")}>
            Clear Email
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
      expect(view.getByTestId("errors").textContent).toContain("name")
    })

    await click(view.getByTestId("clear-email"))
    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).not.toContain("email")
      expect(view.getByTestId("errors").textContent).toContain("name")
    })

    await click(view.getByTestId("clear-all"))
    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toBe("{}")
    })

    await view.unmount()
  })

  it("setError manually sets a field error", async () => {
    function Probe() {
      const form = useIslandForm({ initialData: { email: "" } })

      return (
        <>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="set-error" onClick={() => form.setError("email", "already taken")}>
            Set Error
          </button>
          <button
            data-testid="set-errors"
            onClick={() => form.setError("email", ["too short", "invalid"])}
          >
            Set Errors
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("set-error"))
    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("already taken")
    })

    await click(view.getByTestId("set-errors"))
    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("too short")
      expect(view.getByTestId("errors").textContent).toContain("invalid")
    })

    await view.unmount()
  })

  it("resets specific fields to defaults", async () => {
    function Probe() {
      const form = useIslandForm({
        initialData: { email: "original@example.com", name: "Original" }
      })

      return (
        <>
          <div data-testid="email">{form.data.email}</div>
          <div data-testid="name">{form.data.name}</div>
          <button
            data-testid="change"
            onClick={() => {
              form.setData("email", "changed@example.com")
              form.setData("name", "Changed")
            }}
          >
            Change
          </button>
          <button data-testid="reset-email" onClick={() => form.reset("email")}>
            Reset Email
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("change"))
    await waitForExpectation(() => {
      expect(view.getByTestId("email").textContent).toBe("changed@example.com")
      expect(view.getByTestId("name").textContent).toBe("Changed")
    })

    await click(view.getByTestId("reset-email"))
    await waitForExpectation(() => {
      expect(view.getByTestId("email").textContent).toBe("original@example.com")
      expect(view.getByTestId("name").textContent).toBe("Changed")
    })

    await view.unmount()
  })

  it("defaults getter returns current defaults", async () => {
    function Probe() {
      const form = useIslandForm({ initialData: { email: "a@b.c" } })
      const defs = form.defaults()

      return <div data-testid="defaults">{JSON.stringify(defs)}</div>
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    expect(view.getByTestId("defaults").textContent).toContain("a@b.c")
    await view.unmount()
  })

  it("applies transform before submit", async () => {
    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "UPPER@CASE.COM" },
        transform: (data) => ({ ...data, email: data.email.toLowerCase() })
      })

      return (
        <button data-testid="submit" onClick={() => form.post("save")}>
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
      email: "upper@case.com"
    })

    await view.unmount()
  })

  it("invokes onSuccess callback on ok response", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const onFinish = vi.fn()

    islandFetchMock.mockResolvedValue({ status: "ok", props: {}, version: 2 })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        onSuccess,
        onError,
        onFinish
      })

      return (
        <button data-testid="submit" onClick={() => form.post("save")}>
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
      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(onSuccess.mock.calls[0][0].status).toBe("ok")
      expect(onError).not.toHaveBeenCalled()
      expect(onFinish).toHaveBeenCalledTimes(1)
    })

    await view.unmount()
  })

  it("invokes onError callback on error response", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["invalid"] }
    })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        onSuccess,
        onError
      })

      return (
        <button data-testid="submit" onClick={() => form.post("save")}>
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
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0].status).toBe("error")
      expect(onSuccess).not.toHaveBeenCalled()
    })

    await view.unmount()
  })

  it("invokes onForbidden callback on forbidden response", async () => {
    const onForbidden = vi.fn()
    islandFetchMock.mockResolvedValue({ status: "forbidden" })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "" },
        onForbidden
      })

      return (
        <button data-testid="submit" onClick={() => form.post("save")}>
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
      expect(onForbidden).toHaveBeenCalledTimes(1)
      expect(onForbidden.mock.calls[0][0].status).toBe("forbidden")
    })

    await view.unmount()
  })

  it("resetAndClearErrors resets data and clears errors together", async () => {
    islandFetchMock.mockResolvedValue({
      status: "error",
      errors: { email: ["invalid"] }
    })

    function Probe() {
      const form = useIslandForm({
        initialData: { email: "original@example.com" }
      })

      return (
        <>
          <div data-testid="email">{form.data.email}</div>
          <div data-testid="errors">{JSON.stringify(form.errors)}</div>
          <button data-testid="change" onClick={() => form.setData("email", "changed@example.com")}>
            Change
          </button>
          <button data-testid="submit" onClick={() => form.post("save")}>
            Submit
          </button>
          <button data-testid="reset-clear" onClick={() => form.resetAndClearErrors()}>
            Reset and Clear
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }}>
        <Probe />
      </IslandProvider>
    )

    await click(view.getByTestId("change"))
    await click(view.getByTestId("submit"))

    await waitForExpectation(() => {
      expect(view.getByTestId("errors").textContent).toContain("email")
      expect(view.getByTestId("email").textContent).toBe("changed@example.com")
    })

    await click(view.getByTestId("reset-clear"))

    await waitForExpectation(() => {
      expect(view.getByTestId("email").textContent).toBe("original@example.com")
      expect(view.getByTestId("errors").textContent).toBe("{}")
    })

    await view.unmount()
  })
})
