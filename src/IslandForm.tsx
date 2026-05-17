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

function setNestedValue(
  root: Record<string, unknown>,
  keys: string[],
  value: FormDataEntryValue
): void {
  let current: Record<string, unknown> | unknown[] = root

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const nextKey = keys[i + 1]
    const wantArray = nextKey === ""

    if (Array.isArray(current)) {
      const idx = key === "" ? current.length : Number(key)
      if (current[idx] == null) {
        current[idx] = wantArray ? [] : {}
      }
      current = current[idx] as Record<string, unknown> | unknown[]
    } else {
      if (!(key in current) || current[key] == null) {
        current[key] = wantArray ? [] : {}
      }
      current = current[key] as Record<string, unknown> | unknown[]
    }
  }

  const lastKey = keys[keys.length - 1]

  if (lastKey === "" && Array.isArray(current)) {
    current.push(value)
  } else if (Array.isArray(current)) {
    const idx = Number(lastKey)
    current[idx] = value
  } else {
    current[lastKey] = value
  }
}

const BRACKET_RE = /^([^[]+)((?:\[[^\]]*\])*)$/

function parseBracketKeys(name: string): string[] {
  const match = name.match(BRACKET_RE)
  if (!match) return [name]

  const root = match[1]
  const brackets = match[2]

  if (!brackets) return [root]

  const keys: string[] = [root]
  const bracketParts = brackets.match(/\[([^\]]*)\]/g)
  if (bracketParts) {
    for (const part of bracketParts) {
      keys.push(part.slice(1, -1))
    }
  }
  return keys
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  formData.forEach((value, key) => {
    const keys = parseBracketKeys(key)
    setNestedValue(result, keys, value)
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
