function globalConsumer() {
    const globalValue = globalThis;
    return globalValue.Archipelago?.cable ?? globalValue.App?.cable;
}
export function subscribeToIslandStream({ streamName, onMessage, consumer = globalConsumer() }) {
    if (!consumer || !streamName) {
        return { unsubscribe: () => undefined };
    }
    return consumer.subscriptions.create({
        channel: "Archipelago::IslandChannel",
        stream_name: streamName
    }, {
        received: onMessage
    });
}
//# sourceMappingURL=actionCable.js.map