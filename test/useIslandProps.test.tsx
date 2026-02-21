import React from "react"
import { act } from "react"
import { describe, expect, it, vi } from "vitest"

import { IslandProvider } from "../src/context"
import { useIslandProps } from "../src/useIslandProps"
import { click, renderReact } from "./domHarness"

function buildConsumer() {
  const callbacks: Array<(payload: unknown) => void> = []
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = []

  return {
    consumer: {
      subscriptions: {
        create: (_params: Record<string, unknown>, handlers: { received?: (data: unknown) => void }) => {
          callbacks.push(handlers.received ?? (() => undefined))
          const unsubscribe = vi.fn()
          unsubscribes.push(unsubscribe)
          return {
            unsubscribe
          }
        }
      }
    },
    push(payload: unknown) {
      callbacks.forEach((handler) => handler(payload))
    },
    unsubscribes
  }
}

describe("useIslandProps", () => {
  it("does not subscribe when no stream is provided", async () => {
    const create = vi.fn()
    const consumer = {
      subscriptions: { create }
    }

    function Probe() {
      const { props } = useIslandProps({ consumer })
      return <div data-testid="value">{String(props.count)}</div>
    }

    const view = await renderReact(
      <IslandProvider component="TeamMembers" params={{ team_id: 1 }} initialProps={{ count: 1 }}>
        <Probe />
      </IslandProvider>
    )

    expect(create).not.toHaveBeenCalled()
    await view.unmount()
  })

  it("replaces props on stream updates with newer versions", async () => {
    const cable = buildConsumer()

    function Probe() {
      const { props } = useIslandProps({ consumer: cable.consumer })
      return <div data-testid="value">{String(props.count)}</div>
    }

    const view = await renderReact(
      <IslandProvider
        component="TeamMembers"
        params={{ team_id: 1 }}
        stream="TeamMembers:1"
        initialProps={{ count: 1 }}
        initialVersion={1}
      >
        <Probe />
      </IslandProvider>
    )

    expect(view.getByTestId("value").textContent).toBe("1")

    await act(async () => {
      cable.push({ status: "ok", props: { count: 2 }, version: 2 })
    })

    expect(view.getByTestId("value").textContent).toBe("2")

    await act(async () => {
      cable.push({ status: "ok", props: { count: 3 }, version: 2 })
    })

    expect(view.getByTestId("value").textContent).toBe("2")
    await view.unmount()
    expect(cable.unsubscribes[0]).toHaveBeenCalledTimes(1)
  })

  it("uses custom onLiveProps reconciliation when provided", async () => {
    const cable = buildConsumer()

    function Probe() {
      const { props } = useIslandProps({
        consumer: cable.consumer,
        onLiveProps: (next, previous) => ({
          ...previous,
          ...next,
          touched: true
        })
      })
      return <div data-testid="value">{JSON.stringify(props)}</div>
    }

    const view = await renderReact(
      <IslandProvider
        component="TeamMembers"
        params={{ team_id: 1 }}
        stream="TeamMembers:1"
        initialProps={{ count: 1 }}
        initialVersion={1}
      >
        <Probe />
      </IslandProvider>
    )

    await act(async () => {
      cable.push({ status: "ok", props: { count: 4 }, version: 10 })
    })

    expect(view.getByTestId("value").textContent).toContain('"count":4')
    expect(view.getByTestId("value").textContent).toContain('"touched":true')
    await view.unmount()
  })

  it("ignores non-ok stream payloads", async () => {
    const cable = buildConsumer()

    function Probe() {
      const { props } = useIslandProps({ consumer: cable.consumer })
      return <div data-testid="value">{String(props.count)}</div>
    }

    const view = await renderReact(
      <IslandProvider
        component="TeamMembers"
        params={{ team_id: 1 }}
        stream="TeamMembers:1"
        initialProps={{ count: 1 }}
        initialVersion={1}
      >
        <Probe />
      </IslandProvider>
    )

    await act(async () => {
      cable.push({ status: "error", errors: { base: ["bad"] } })
      cable.push({ nope: true })
    })

    expect(view.getByTestId("value").textContent).toBe("1")
    await view.unmount()
  })

  it("setProps updates props without changing version", async () => {
    function Probe() {
      const { props, version, setProps } = useIslandProps()

      return (
        <>
          <div data-testid="value">{String(props.count)}</div>
          <div data-testid="version">{String(version)}</div>
          <button data-testid="set" onClick={() => setProps({ count: 9 })}>
            Set
          </button>
        </>
      )
    }

    const view = await renderReact(
      <IslandProvider
        component="TeamMembers"
        params={{ team_id: 1 }}
        initialProps={{ count: 1 }}
        initialVersion={5}
      >
        <Probe />
      </IslandProvider>
    )

    expect(view.getByTestId("version").textContent).toBe("5")
    await click(view.getByTestId("set"))

    expect(view.getByTestId("value").textContent).toBe("9")
    expect(view.getByTestId("version").textContent).toBe("5")
    await view.unmount()
  })
})
