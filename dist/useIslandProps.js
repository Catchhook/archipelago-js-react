import { parseIslandResponse } from "@archipelago/client";
import { useEffect, useMemo, useRef } from "react";
import { subscribeToIslandStream } from "./actionCable";
import { useIslandContext } from "./context";
function streamVersion(payload, currentVersion) {
    return typeof payload.version === "number" ? payload.version : currentVersion + 1;
}
export function useIslandProps(options = {}) {
    const { state, setState, stream: contextStream } = useIslandContext();
    const onLiveProps = options.onLiveProps;
    const stream = options.stream ?? contextStream;
    const versionRef = useRef(state.version);
    useEffect(() => {
        versionRef.current = state.version;
    }, [state.version]);
    useEffect(() => {
        if (!stream) {
            return undefined;
        }
        const subscription = subscribeToIslandStream({
            streamName: stream,
            consumer: options.consumer,
            onMessage: (rawPayload) => {
                let parsed;
                try {
                    parsed = parseIslandResponse(rawPayload);
                }
                catch {
                    return;
                }
                if (parsed.status !== "ok") {
                    return;
                }
                const nextVersion = streamVersion(parsed, versionRef.current);
                if (nextVersion <= versionRef.current) {
                    return;
                }
                setState((previous) => {
                    const nextProps = onLiveProps
                        ? onLiveProps(parsed.props, previous.props)
                        : parsed.props;
                    return {
                        props: nextProps,
                        version: nextVersion
                    };
                });
            }
        });
        return () => {
            subscription.unsubscribe();
        };
    }, [onLiveProps, options.consumer, setState, stream]);
    return useMemo(() => {
        return {
            props: state.props,
            setProps: (next) => {
                setState((previous) => ({
                    props: next,
                    version: previous.version
                }));
            },
            version: state.version
        };
    }, [setState, state.props, state.version]);
}
//# sourceMappingURL=useIslandProps.js.map