import { islandFetch, type IslandResponse } from "@archipelago-js/client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useIslandContext } from "./context"

type FormMethod = "post" | "put" | "patch" | "delete"

type SubmitOverrides = {
  payload?: Record<string, unknown>
  navigate?: (location: string) => void
}

export interface UseIslandFormCallbacks<TData extends Record<string, unknown>> {
  onSuccess?: (response: IslandResponse) => void
  onError?: (response: IslandResponse) => void
  onForbidden?: (response: IslandResponse) => void
  onFinish?: (response: IslandResponse | undefined) => void
}

export interface UseIslandFormOptions<TData extends Record<string, unknown>>
  extends UseIslandFormCallbacks<TData> {
  initialData: TData
  clearFieldErrorsOnChange?: boolean
  fixedParams?: Record<string, unknown>
  recentlySuccessfulDuration?: number
  transform?: (payload: TData) => Record<string, unknown>
}

export type UploadProgress = {
  percentage: number
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function isFormDataLike(value: unknown): boolean {
  return typeof FormData !== "undefined" && value instanceof FormData
}

export function useIslandForm<TData extends Record<string, unknown>>({
  initialData,
  clearFieldErrorsOnChange = true,
  fixedParams = {},
  recentlySuccessfulDuration = 2000,
  transform,
  onSuccess,
  onError,
  onForbidden,
  onFinish
}: UseIslandFormOptions<TData>) {
  const { component, params, stream, setState } = useIslandContext()
  const [data, setDataState] = useState<TData>(initialData)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [processing, setProcessing] = useState(false)
  const [wasSuccessful, setWasSuccessful] = useState(false)
  const [recentlySuccessful, setRecentlySuccessful] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [transportError, setTransportError] = useState<Error | null>(null)

  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null)
  const defaultsRef = useRef<TData>(deepClone(initialData))
  const recentlySuccessfulTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (recentlySuccessfulTimerRef.current) {
        clearTimeout(recentlySuccessfulTimerRef.current)
      }
    }
  }, [])

  const setData = useCallback(
    <K extends keyof TData>(field: K, value: TData[K]) => {
      setDataState((previous) => ({
        ...previous,
        [field]: value
      }))

      if (clearFieldErrorsOnChange) {
        setErrors((previous) => {
          if (!(field as string in previous)) {
            return previous
          }

          const next = { ...previous }
          delete next[field as string]
          return next
        })
      }
    },
    [clearFieldErrorsOnChange]
  )

  const clearErrors = useCallback((...fields: (keyof TData)[]) => {
    if (fields.length === 0) {
      setErrors({})
      return
    }
    setErrors((previous) => {
      const next = { ...previous }
      for (const field of fields) {
        delete next[field as string]
      }
      return next
    })
  }, [])

  const setError = useCallback((field: keyof TData | string, message: string | string[]) => {
    const messages = Array.isArray(message) ? message : [message]
    setErrors((previous) => ({
      ...previous,
      [field as string]: messages
    }))
  }, [])

  const defaults = useCallback(
    (...args: [] | [Partial<TData>] | [keyof TData, TData[keyof TData]]) => {
      if (args.length === 0) {
        return deepClone(defaultsRef.current)
      }
      if (args.length === 1 && typeof args[0] === "object") {
        defaultsRef.current = deepClone({ ...defaultsRef.current, ...args[0] }) as TData
        return defaultsRef.current
      }
      if (args.length === 2) {
        const [field, value] = args as [keyof TData, TData[keyof TData]]
        defaultsRef.current = deepClone({ ...defaultsRef.current, [field]: value }) as TData
        return defaultsRef.current
      }
      return deepClone(defaultsRef.current)
    },
    []
  )

  const reset = useCallback(
    (...fields: (keyof TData)[]) => {
      if (fields.length === 0) {
        setDataState(deepClone(defaultsRef.current))
        setErrors({})
        return
      }
      setDataState((previous) => {
        const next = { ...previous }
        for (const field of fields) {
          if (field in defaultsRef.current) {
            next[field] = deepClone(defaultsRef.current[field])
          }
        }
        return next
      })
    },
    []
  )

  const resetAndClearErrors = useCallback(
    (...fields: (keyof TData)[]) => {
      reset(...fields)
      clearErrors(...fields)
    },
    [reset, clearErrors]
  )

  const submit = useCallback(
    async (method: FormMethod, operation: string, overrides: SubmitOverrides = {}) => {
      requestRef.current?.controller.abort()

      const controller = new AbortController()
      const requestId = (requestRef.current?.id ?? 0) + 1
      requestRef.current = { id: requestId, controller }
      setProcessing(true)
      setWasSuccessful(false)
      setRecentlySuccessful(false)
      setTransportError(null)
      setProgress(null)

      if (recentlySuccessfulTimerRef.current) {
        clearTimeout(recentlySuccessfulTimerRef.current)
        recentlySuccessfulTimerRef.current = null
      }

      const rawPayload = method === "post" ? data : { ...data, _method: method }
      const payload = transform ? transform(rawPayload as TData) : rawPayload

      try {
        const response = await islandFetch(component, operation, payload, {
          signal: controller.signal,
          fixedParams: {
            ...params,
            ...fixedParams
          },
          overridePayload: overrides.payload,
          navigate: overrides.navigate,
          stream: stream ?? undefined
        })

        if (requestRef.current?.id !== requestId) {
          return response
        }

        if (response.status === "ok") {
          setErrors({})
          setWasSuccessful(true)
          setRecentlySuccessful(true)
          recentlySuccessfulTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setRecentlySuccessful(false)
            }
          }, recentlySuccessfulDuration)

          setState((previous) => ({
            props: response.props,
            version:
              typeof response.version === "number" && response.version > previous.version
                ? response.version
                : previous.version
          }))

          onSuccess?.(response)
        }

        if (response.status === "redirect") {
          setWasSuccessful(true)
          setRecentlySuccessful(true)
          recentlySuccessfulTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setRecentlySuccessful(false)
            }
          }, recentlySuccessfulDuration)

          onSuccess?.(response)
        }

        if (response.status === "error") {
          setErrors(response.errors)
          onError?.(response)
        }

        if (response.status === "forbidden") {
          setErrors({ _base: ["forbidden"] })
          onForbidden?.(response)
        }

        onFinish?.(response)
        return response
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return undefined
        }

        if (requestRef.current?.id === requestId) {
          setTransportError(error instanceof Error ? error : new Error(String(error)))
        }

        onFinish?.(undefined)
        return undefined
      } finally {
        if (requestRef.current?.id === requestId) {
          setProcessing(false)
          setProgress(null)
        }
      }
    },
    [
      component,
      data,
      fixedParams,
      onError,
      onFinish,
      onForbidden,
      onSuccess,
      params,
      recentlySuccessfulDuration,
      setState,
      stream,
      transform
    ]
  )

  return useMemo(() => {
    return {
      data,
      setData,
      errors,
      setError,
      clearErrors,
      processing,
      wasSuccessful,
      recentlySuccessful,
      progress,
      transportError,
      defaults,
      reset,
      resetAndClearErrors,
      post: (operation: string, overrides?: SubmitOverrides) => submit("post", operation, overrides),
      put: (operation: string, overrides?: SubmitOverrides) => submit("put", operation, overrides),
      patch: (operation: string, overrides?: SubmitOverrides) =>
        submit("patch", operation, overrides),
      delete: (operation: string, overrides?: SubmitOverrides) =>
        submit("delete", operation, overrides)
    }
  }, [
    clearErrors,
    data,
    defaults,
    errors,
    processing,
    progress,
    recentlySuccessful,
    reset,
    resetAndClearErrors,
    setData,
    setError,
    submit,
    transportError,
    wasSuccessful
  ])
}
