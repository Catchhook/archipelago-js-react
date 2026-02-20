import React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"

export type RenderHarness = {
  container: HTMLElement
  getByTestId: (id: string) => HTMLElement
  unmount: () => Promise<void>
}

export async function renderReact(node: React.ReactNode): Promise<RenderHarness> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<>{node}</>)
  })

  return {
    container,
    getByTestId: (id: string) => {
      const element = container.querySelector(`[data-testid="${id}"]`)
      if (!element) {
        throw new Error(`Missing element with data-testid=${id}`)
      }

      return element as HTMLElement
    },
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
  }
}

export async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

export async function changeInput(element: HTMLElement, value: string): Promise<void> {
  await act(async () => {
    ;(element as HTMLInputElement).value = value
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

export async function waitForExpectation(
  assertion: () => void,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1000
  const intervalMs = options.intervalMs ?? 10
  const startedAt = Date.now()

  while (true) {
    try {
      assertion()
      return
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error
      }

      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs)
      })
    }
  }
}
