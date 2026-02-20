export type CableSubscription = {
    unsubscribe: () => void;
};
export type CableConsumer = {
    subscriptions: {
        create: (params: Record<string, unknown>, callbacks: {
            received?: (data: unknown) => void;
        }) => CableSubscription;
    };
};
export type StreamSubscriptionOptions = {
    streamName: string;
    onMessage: (payload: unknown) => void;
    consumer?: CableConsumer;
};
export declare function subscribeToIslandStream({ streamName, onMessage, consumer }: StreamSubscriptionOptions): CableSubscription;
