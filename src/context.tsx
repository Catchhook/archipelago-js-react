import React, { createContext, useContext, useMemo, useState } from "react"

type IslandState = {
  props: Record<string, unknown>
  version: number
}

export interface IslandContextValue {
  component: string
  params: Record<string, unknown>
  instance?: string
  stream?: string
  state: IslandState
  setState: React.Dispatch<React.SetStateAction<IslandState>>
}

const IslandContext = createContext<IslandContextValue | null>(null)

export interface IslandProviderProps {
  children: React.ReactNode
  component: string
  params: Record<string, unknown>
  instance?: string
  stream?: string
  initialProps?: Record<string, unknown>
  initialVersion?: number
}

export function IslandProvider({
  children,
  component,
  params,
  instance,
  stream,
  initialProps = {},
  initialVersion = 0
}: IslandProviderProps): React.ReactElement {
  const [state, setState] = useState<IslandState>({
    props: initialProps,
    version: initialVersion
  })

  const value = useMemo<IslandContextValue>(() => {
    return {
      component,
      params,
      instance,
      stream,
      state,
      setState
    }
  }, [component, instance, params, state, stream])

  return <IslandContext.Provider value={value}>{children}</IslandContext.Provider>
}

export function useIslandContext(): IslandContextValue {
  const value = useContext(IslandContext)
  if (!value) {
    throw new Error("useIslandContext must be used inside IslandProvider")
  }

  return value
}
