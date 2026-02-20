export type CableSubscription = {
  unsubscribe: () => void
}

export type CableConsumer = {
  subscriptions: {
    create: (
      params: Record<string, unknown>,
      callbacks: { received?: (data: unknown) => void }
    ) => CableSubscription
  }
}

export type StreamSubscriptionOptions = {
  streamName: string
  onMessage: (payload: unknown) => void
  consumer?: CableConsumer
}

function globalConsumer(): CableConsumer | undefined {
  const globalValue = globalThis as typeof globalThis & {
    App?: { cable?: CableConsumer }
    Archipelago?: { cable?: CableConsumer }
  }

  return globalValue.Archipelago?.cable ?? globalValue.App?.cable
}

export function subscribeToIslandStream({
  streamName,
  onMessage,
  consumer = globalConsumer()
}: StreamSubscriptionOptions): CableSubscription {
  if (!consumer || !streamName) {
    return { unsubscribe: () => undefined }
  }

  return consumer.subscriptions.create(
    {
      channel: "Archipelago::IslandChannel",
      stream_name: streamName
    },
    {
      received: onMessage
    }
  )
}
