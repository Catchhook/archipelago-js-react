import { islandFetch } from "@archipelago-js/client"
import { useCallback, useMemo, useRef, useState } from "react"

import { useIslandContext } from "./context"

type FormMethod = "post" | "put" | "patch" | "delete"

type SubmitOverrides = {
  payload?: Record<string, unknown>
  navigate?: (location: string) => void
}

export interface UseIslandFormOptions<TData extends Record<string, unknown>> {
  initialData: TData
  clearFieldErrorsOnChange?: boolean
  fixedParams?: Record<string, unknown>
}

export function useIslandForm<TData extends Record<string, unknown>>({
  initialData,
  clearFieldErrorsOnChange = true,
  fixedParams = {}
}: UseIslandFormOptions<TData>) {
  const { component, params, stream, setState } = useIslandContext()
  const [data, setDataState] = useState<TData>(initialData)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [processing, setProcessing] = useState(false)

  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null)

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

  const submit = useCallback(
    async (method: FormMethod, operation: string, overrides: SubmitOverrides = {}) => {
      requestRef.current?.controller.abort()

      const controller = new AbortController()
      const requestId = (requestRef.current?.id ?? 0) + 1
      requestRef.current = { id: requestId, controller }
      setProcessing(true)

      const payload = method === "post" ? data : { ...data, _method: method }

      try {
        const response = await islandFetch(component, operation, payload, {
          signal: controller.signal,
          fixedParams: {
            ...params,
            ...fixedParams,
            ...(stream ? { __stream: stream } : {})
          },
          overridePayload: overrides.payload,
          navigate: overrides.navigate
        })

        if (requestRef.current?.id !== requestId) {
          return response
        }

        if (response.status === "ok") {
          setErrors({})
          setState((previous) => ({
            props: response.props,
            version:
              typeof response.version === "number" && response.version > previous.version
                ? response.version
                : previous.version
          }))
        }

        if (response.status === "error") {
          setErrors(response.errors)
        }

        if (response.status === "forbidden") {
          setErrors({ _base: ["forbidden"] })
        }

        return response
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return undefined
        }

        throw error
      } finally {
        if (requestRef.current?.id === requestId) {
          setProcessing(false)
        }
      }
    },
    [component, data, fixedParams, params, setState, stream]
  )

  const reset = useCallback(() => {
    setDataState(initialData)
    setErrors({})
  }, [initialData])

  return useMemo(() => {
    return {
      data,
      setData,
      errors,
      processing,
      post: (operation: string, overrides?: SubmitOverrides) => submit("post", operation, overrides),
      put: (operation: string, overrides?: SubmitOverrides) => submit("put", operation, overrides),
      patch: (operation: string, overrides?: SubmitOverrides) =>
        submit("patch", operation, overrides),
      delete: (operation: string, overrides?: SubmitOverrides) =>
        submit("delete", operation, overrides),
      reset
    }
  }, [data, errors, processing, reset, setData, submit])
}
