import { describe, expect, it, vi } from "vitest"

import { subscribeToIslandStream, type CableConsumer } from "../src/actionCable"

describe("subscribeToIslandStream", () => {
  it("creates a subscription with expected channel params", () => {
    const unsubscribe = vi.fn()
    const create = vi.fn((_params: Record<string, unknown>, _callbacks: { received?: (data: unknown) => void }) => ({
      unsubscribe
    }))
    const consumer: CableConsumer = {
      subscriptions: { create }
    }
    const onMessage = vi.fn()

    const subscription = subscribeToIslandStream({
      streamName: "TeamMembers:1",
      onMessage,
      consumer
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toEqual({
      channel: "Archipelago::IslandChannel",
      stream_name: "TeamMembers:1"
    })

    const callbacks = create.mock.calls[0][1]
    callbacks.received?.({ ok: true })
    expect(onMessage).toHaveBeenCalledWith({ ok: true })

    subscription.unsubscribe()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("returns a no-op subscription when stream name is blank", () => {
    const consumer: CableConsumer = {
      subscriptions: {
        create: vi.fn()
      }
    }

    const subscription = subscribeToIslandStream({
      streamName: "",
      onMessage: vi.fn(),
      consumer
    })

    expect(consumer.subscriptions.create).not.toHaveBeenCalled()
    expect(() => subscription.unsubscribe()).not.toThrow()
  })

  it("uses Archipelago.cable global fallback before App.cable", () => {
    const archipelagoCreate = vi.fn((_params, _callbacks) => ({ unsubscribe: vi.fn() }))
    const appCreate = vi.fn((_params, _callbacks) => ({ unsubscribe: vi.fn() }))

    const globalValue = globalThis as typeof globalThis & {
      Archipelago?: { cable?: CableConsumer }
      App?: { cable?: CableConsumer }
    }

    globalValue.Archipelago = {
      cable: { subscriptions: { create: archipelagoCreate } }
    }
    globalValue.App = {
      cable: { subscriptions: { create: appCreate } }
    }

    subscribeToIslandStream({
      streamName: "TeamMembers:2",
      onMessage: vi.fn()
    })

    expect(archipelagoCreate).toHaveBeenCalledTimes(1)
    expect(appCreate).not.toHaveBeenCalled()

    delete globalValue.Archipelago
    delete globalValue.App
  })
})
