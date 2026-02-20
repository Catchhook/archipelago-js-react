import { parseIslandResponse } from "@archipelago/client"
import { useEffect, useMemo, useRef } from "react"

import { subscribeToIslandStream, type CableConsumer } from "./actionCable"
import { useIslandContext } from "./context"

export interface UseIslandPropsOptions {
  stream?: string
  onLiveProps?: (
    next: Record<string, unknown>,
    previous: Record<string, unknown>
  ) => Record<string, unknown>
  consumer?: CableConsumer
}

function streamVersion(payload: { version?: number }, currentVersion: number): number {
  return typeof payload.version === "number" ? payload.version : currentVersion + 1
}

export function useIslandProps(options: UseIslandPropsOptions = {}) {
  const { state, setState, stream: contextStream } = useIslandContext()
  const onLiveProps = options.onLiveProps
  const stream = options.stream ?? contextStream
  const versionRef = useRef(state.version)

  useEffect(() => {
    versionRef.current = state.version
  }, [state.version])

  useEffect(() => {
    if (!stream) {
      return undefined
    }

    const subscription = subscribeToIslandStream({
      streamName: stream,
      consumer: options.consumer,
      onMessage: (rawPayload) => {
        let parsed: ReturnType<typeof parseIslandResponse>
        try {
          parsed = parseIslandResponse(rawPayload)
        } catch {
          return
        }

        if (parsed.status !== "ok") {
          return
        }

        const nextVersion = streamVersion(parsed, versionRef.current)
        if (nextVersion <= versionRef.current) {
          return
        }

        setState((previous) => {
          const nextProps = onLiveProps
            ? onLiveProps(parsed.props, previous.props)
            : parsed.props

          return {
            props: nextProps,
            version: nextVersion
          }
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [onLiveProps, options.consumer, setState, stream])

  return useMemo(() => {
    return {
      props: state.props,
      setProps: (next: Record<string, unknown>) => {
        setState((previous) => ({
          props: next,
          version: previous.version
        }))
      },
      version: state.version
    }
  }, [setState, state.props, state.version])
}
