import React from "react"
import { createRoot, Root } from "react-dom/client"

import { ErrorBoundary } from "./ErrorBoundary"
import { IslandProvider } from "./context"

export type IslandComponent = React.ComponentType
export type IslandLoader = () => Promise<{ default: IslandComponent } | IslandComponent>

export type IslandRegistryEntry =
  | IslandComponent
  | {
      load: IslandLoader
      fallback?: React.ReactNode
    }

export type IslandRegistry = Record<string, IslandRegistryEntry>

type MountedRecord = {
  root: Root
}

const mounted = new Map<Element, MountedRecord>()
const mounting = new Set<Element>()
let listenersAttached = false
let activeRegistry: IslandRegistry | null = null
let observer: MutationObserver | null = null
let bootScheduled = false

function scheduleBoot(): void {
  if (!activeRegistry || bootScheduled) {
    return
  }

  bootScheduled = true
  queueMicrotask(() => {
    bootScheduled = false
    if (activeRegistry) {
      void bootArchipelagoIslands(activeRegistry)
    }
  })
}

function nodeContainsIsland(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false
  }

  return node.hasAttribute("data-island") || node.querySelector("[data-island]") != null
}

function ensureObserverAttached(): void {
  if (observer || typeof MutationObserver === "undefined") {
    return
  }

  const target = document.body ?? document.documentElement
  if (!target) {
    return
  }

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (nodeContainsIsland(node)) {
          scheduleBoot()
          return
        }
      }
    }
  })

  observer.observe(target, { childList: true, subtree: true })
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (!value || value.trim().length === 0) {
    return {}
  }

  const parsed = JSON.parse(value)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected JSON object")
  }

  return parsed as Record<string, unknown>
}

function parseVersion(value: string | undefined): number {
  if (!value) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function resolveComponent(entry: IslandRegistryEntry): Promise<IslandComponent> {
  if (typeof entry === "function") {
    return entry
  }

  const loaded = await entry.load()
  return "default" in loaded ? loaded.default : loaded
}

function mountElement(element: HTMLElement, component: IslandComponent, fallback?: React.ReactNode): void {
  let params: Record<string, unknown> = {}
  let initialProps: Record<string, unknown> = {}
  let initialVersion = 0

  try {
    params = parseJsonObject(element.dataset.params)
    initialProps = parseJsonObject(element.dataset.props)
    initialVersion = parseVersion(element.dataset.version)
  } catch {
    return
  }

  const root = createRoot(element)
  mounted.set(element, { root })

  const { component: componentName, instance, stream } = element.dataset

  root.render(
    <ErrorBoundary fallback={fallback}>
      <IslandProvider
        component={componentName ?? ""}
        params={params}
        initialProps={initialProps}
        initialVersion={initialVersion}
        instance={instance}
        stream={stream}
      >
        {React.createElement(component)}
      </IslandProvider>
    </ErrorBoundary>
  )
}

export async function bootArchipelagoIslands(registry: IslandRegistry): Promise<void> {
  activeRegistry = registry
  const islands = Array.from(document.querySelectorAll<HTMLElement>("[data-island]"))

  for (const island of islands) {
    if (mounted.has(island) || mounting.has(island)) {
      continue
    }

    const componentName = island.dataset.component
    if (!componentName) {
      continue
    }

    const entry = registry[componentName]
    if (!entry) {
      continue
    }

    mounting.add(island)
    try {
      const component = await resolveComponent(entry)
      if (mounted.has(island)) {
        continue
      }

      const fallback = typeof entry === "function" ? undefined : entry.fallback
      mountElement(island, component, fallback)
      if (mounted.has(island)) {
        island.dataset.mounted = "true"
      }
    } finally {
      mounting.delete(island)
    }
  }

  if (!listenersAttached) {
    listenersAttached = true

    document.addEventListener("turbo:load", scheduleBoot)
    document.addEventListener("turbo:render", scheduleBoot)
    document.addEventListener("turbo:frame-load", scheduleBoot)

    document.addEventListener("turbo:before-cache", () => {
      unmountArchipelagoIslands()
    })

    ensureObserverAttached()
  }
}

export function unmountArchipelagoIslands(): void {
  mounting.clear()

  for (const [element, record] of mounted.entries()) {
    record.root.unmount()
    element.removeAttribute("data-mounted")
    mounted.delete(element)
  }
}

export function defineIslandLoader(load: IslandLoader, fallback?: React.ReactNode): IslandRegistryEntry {
  return { load, fallback }
}
