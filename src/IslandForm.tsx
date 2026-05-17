import React, { useCallback, useRef } from "react"

import { useIslandForm, type UseIslandFormCallbacks } from "./useIslandForm"

type FormMethod = "post" | "put" | "patch" | "delete"

type IslandFormRenderProps = ReturnType<typeof useIslandForm>

export interface IslandFormProps extends UseIslandFormCallbacks<Record<string, unknown>> {
  operation: string
  method?: FormMethod
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>
  resetOnSuccess?: boolean
  clearErrorsOnSuccess?: boolean
  fixedParams?: Record<string, unknown>
  className?: string
  children: React.ReactNode | ((form: IslandFormRenderProps) => React.ReactNode)
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  formData.forEach((value, key) => {
    const existing = result[key]
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        result[key] = [existing, value]
      }
    } else {
      result[key] = value
    }
  })

  return result
}

export function IslandForm({
  operation,
  method = "post",
  transform,
  resetOnSuccess = false,
  clearErrorsOnSuccess = false,
  fixedParams,
  className,
  children,
  onSuccess,
  onError,
  onForbidden,
  onFinish
}: IslandFormProps): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null)

  const form = useIslandForm<Record<string, unknown>>({
    initialData: {},
    fixedParams,
    transform,
    onSuccess: (response) => {
      if (resetOnSuccess) {
        form.reset()
        formRef.current?.reset()
      }
      if (clearErrorsOnSuccess) {
        form.clearErrors()
      }
      onSuccess?.(response)
    },
    onError,
    onForbidden,
    onFinish
  })

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const formData = new FormData(event.currentTarget)
      const payload = formDataToObject(formData)

      const submitFn = form[method]
      submitFn(operation, { payload })
    },
    [form, method, operation]
  )

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className}>
      {typeof children === "function" ? children(form) : children}
    </form>
  )
}
