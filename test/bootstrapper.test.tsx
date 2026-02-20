import React from "react"
import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  bootArchipelagoIslands,
  defineIslandLoader,
  unmountArchipelagoIslands
} from "../src/bootstrapper"

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

async function boot(registry: Parameters<typeof bootArchipelagoIslands>[0]): Promise<void> {
  await act(async () => {
    await bootArchipelagoIslands(registry)
  })
  await flush()
}

describe("bootArchipelagoIslands", () => {
  afterEach(async () => {
    await act(async () => {
      unmountArchipelagoIslands()
    })
    document.body.innerHTML = ""
  })

  it("mounts islands and skips already-mounted nodes", async () => {
    const renderSpy = vi.fn()

    function TeamMembers() {
      renderSpy()
      return <div data-testid="island">mounted</div>
    }

    document.body.innerHTML = `
      <div
        data-island="true"
        data-component="TeamMembers"
        data-props='{"members":[]}'
        data-params='{"team_id":1}'
      ></div>
    `

    await boot({ TeamMembers })

    expect(document.body.textContent).toContain("mounted")
    expect(renderSpy).toHaveBeenCalledTimes(1)

    await boot({ TeamMembers })

    expect(renderSpy).toHaveBeenCalledTimes(1)
  })

  it("supports async registry entries", async () => {
    function TeamMembers() {
      return <div>async-mounted</div>
    }

    document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `

    await boot({
      TeamMembers: defineIslandLoader(async () => ({ default: TeamMembers }))
    })

    expect(document.body.textContent).toContain("async-mounted")
  })

  it("avoids duplicate mounts when boot is called concurrently", async () => {
    const renderSpy = vi.fn()

    function TeamMembers() {
      renderSpy()
      return <div>concurrent-mounted</div>
    }

    document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `

    const registry = {
      TeamMembers: defineIslandLoader(
        async () =>
          await new Promise((resolve) => {
            setTimeout(() => resolve({ default: TeamMembers }), 5)
          })
      )
    }

    await act(async () => {
      await Promise.all([bootArchipelagoIslands(registry), bootArchipelagoIslands(registry)])
    })
    await flush()

    expect(renderSpy).toHaveBeenCalledTimes(1)
  })

  it("mounts new islands on turbo:load", async () => {
    function TeamMembers() {
      return <div>live-mount</div>
    }

    document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `

    await boot({ TeamMembers })

    const next = document.createElement("div")
    next.setAttribute("data-island", "true")
    next.setAttribute("data-component", "TeamMembers")
    next.setAttribute("data-props", "{}")
    next.setAttribute("data-params", "{}")
    document.body.appendChild(next)

    await act(async () => {
      document.dispatchEvent(new Event("turbo:load"))
    })
    await flush()

    const matches = Array.from(document.body.querySelectorAll("[data-mounted='true']"))
    expect(matches).toHaveLength(2)
  })

  it("mounts islands added after initial boot without turbo:load", async () => {
    function TeamMembers() {
      return <div>observer-mount</div>
    }

    document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `

    await boot({ TeamMembers })

    const streamed = document.createElement("div")
    streamed.setAttribute("data-island", "true")
    streamed.setAttribute("data-component", "TeamMembers")
    streamed.setAttribute("data-props", "{}")
    streamed.setAttribute("data-params", "{}")
    await act(async () => {
      document.body.appendChild(streamed)
      await flush()
      await flush()
    })

    const matches = Array.from(document.body.querySelectorAll("[data-mounted='true']"))
    expect(matches).toHaveLength(2)
  })

  it("unmounts on turbo:before-cache", async () => {
    function TeamMembers() {
      return <div>cache-target</div>
    }

    document.body.innerHTML = `
      <div data-island="true" data-component="TeamMembers" data-props='{}' data-params='{}'></div>
    `

    await boot({ TeamMembers })

    expect(document.body.textContent).toContain("cache-target")

    await act(async () => {
      document.dispatchEvent(new Event("turbo:before-cache"))
    })
    await flush()

    expect(document.body.textContent).not.toContain("cache-target")
    await act(async () => {
      unmountArchipelagoIslands()
    })
  })
})
