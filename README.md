# @archipelago-js/react

React bindings for [Archipelago](https://github.com/robrace/archipelago) islands — server-rendered micro-frontends powered by Rails and React.

## Install

```bash
yarn add @archipelago-js/react @archipelago-js/client react react-dom
```

## 60-Second Quick Start

### 1. Rails View Helper

Render an island from any ERB template:

```erb
<%= archipelago_island("TeamMembers", props: { team_id: @team.id }, stream: "team:#{@team.id}") %>
```

### 2. React Island Component

Create `app/javascript/islands/TeamMembers.tsx`:

```tsx
import { useIslandProps, useIslandForm } from "@archipelago-js/react"

export default function TeamMembers() {
  const { props } = useIslandProps()
  const form = useIslandForm({ initialData: { name: "" } })

  return (
    <div>
      <h2>Team #{props.team_id}</h2>
      <input
        value={form.data.name}
        onChange={(e) => form.setData("name", e.target.value)}
      />
      <button onClick={() => form.post("add_member")} disabled={form.processing}>
        {form.recentlySuccessful ? "Added!" : "Add Member"}
      </button>
      {form.errors.name?.map((e) => <p key={e}>{e}</p>)}
    </div>
  )
}
```

### 3. Boot Islands

In your JS entry file:

```tsx
import { bootArchipelagoIslands } from "@archipelago-js/react"
import TeamMembers from "../islands/TeamMembers"

void bootArchipelagoIslands({
  TeamMembers
})
```

## Context

Every island is wrapped in an `IslandProvider` that provides context via `useIslandContext()`:

| Field       | Type                           | Description                                 |
|-------------|--------------------------------|---------------------------------------------|
| `component` | `string`                       | Island component name                       |
| `params`    | `Record<string, unknown>`      | Server-side params embedded in the HTML     |
| `instance`  | `string \| undefined`          | Optional instance identifier                |
| `stream`    | `string \| undefined`          | ActionCable stream name for live updates    |
| `state`     | `{ props, version }`           | Current props and version                   |
| `setState`  | `Dispatch<SetStateAction<…>>`  | Update island state                         |

`useIslandProps()` is the primary way to read props:

```tsx
const { props, setProps, version } = useIslandProps()
```

## Forms

### `useIslandForm` (Controlled)

The form hook manages data, errors, processing state, and submission:

```tsx
const form = useIslandForm({
  initialData: { email: "", role: "member" },
  clearFieldErrorsOnChange: true,
  recentlySuccessfulDuration: 2000,
  transform: (data) => ({ ...data, email: data.email.toLowerCase() }),
  onSuccess: (response) => console.log("Saved!", response),
  onError: (response) => console.log("Validation failed", response),
  onFinish: () => console.log("Request complete")
})
```

**Returned values:**

| Property               | Type                                    | Description                                      |
|------------------------|-----------------------------------------|--------------------------------------------------|
| `data`                 | `TData`                                 | Current form data                                |
| `setData(field, val)`  | `(field, value) => void`                | Set a field value                                |
| `errors`               | `Record<string, string[]>`              | Field-keyed validation errors                    |
| `setError(field, msg)` | `(field, message) => void`              | Manually set a field error                       |
| `clearErrors(...f?)`   | `(...fields?) => void`                  | Clear all or specific errors                     |
| `processing`           | `boolean`                               | True while request is in flight                  |
| `wasSuccessful`        | `boolean`                               | True after an ok/redirect response               |
| `recentlySuccessful`   | `boolean`                               | True for `recentlySuccessfulDuration` ms after success |
| `progress`             | `{ percentage } \| null`                | Upload progress (future XHR support)             |
| `transportError`       | `Error \| null`                         | Network/parse error (not a validation error)     |
| `defaults(...)`        | Getter/setter for default values        | `defaults()` returns defaults; `defaults(next)` updates them |
| `reset(...fields?)`    | `(...fields?) => void`                  | Reset all or specific fields to defaults         |
| `resetAndClearErrors`  | `(...fields?) => void`                  | Reset data + clear errors                        |
| `post(op, overrides?)` | `(operation, overrides?) => Promise`    | Submit with POST                                 |
| `put` / `patch` / `delete` | Same as `post`                      | Submit with PUT / PATCH / DELETE                 |

### `<IslandForm>` (Declarative / Uncontrolled)

For simple forms that don't need keystroke-level control:

```tsx
import { IslandForm } from "@archipelago-js/react"

<IslandForm operation="update_settings" method="patch" resetOnSuccess>
  <input name="display_name" defaultValue={props.display_name} />
  <button type="submit">Save</button>
</IslandForm>
```

Render-prop children get access to the full form object:

```tsx
<IslandForm operation="create_post" method="post">
  {(form) => (
    <>
      <input name="title" />
      {form.errors.title?.map((e) => <span key={e}>{e}</span>)}
      <button type="submit" disabled={form.processing}>
        {form.recentlySuccessful ? "Created!" : "Create"}
      </button>
    </>
  )}
</IslandForm>
```

**Props:**

| Prop                   | Type                     | Default   |
|------------------------|--------------------------|-----------|
| `operation`            | `string`                 | required  |
| `method`               | `FormMethod`             | `"post"`  |
| `transform`            | `(data) => data`         | —         |
| `resetOnSuccess`       | `boolean`                | `false`   |
| `clearErrorsOnSuccess` | `boolean`                | `false`   |
| `fixedParams`          | `Record<string, unknown>`| —         |
| `onSuccess`            | `(response) => void`     | —         |
| `onError`              | `(response) => void`     | —         |
| `onForbidden`          | `(response) => void`     | —         |
| `onFinish`             | `(response?) => void`    | —         |

## Streams (Live Updates via ActionCable)

Islands with a `stream` attribute automatically subscribe to an ActionCable channel. When a broadcast arrives, `useIslandProps()` updates the props in real time.

### Setup

Assign an ActionCable consumer globally:

```ts
import { createConsumer } from "@rails/actioncable"
window.Archipelago = { cable: createConsumer() }
```

### Server Broadcast

```ruby
Archipelago.broadcast("team:#{team.id}", props: { members: team.members.as_json })
```

### Custom Merge Logic

Use `onLiveProps` to merge incoming props with the current state:

```tsx
const { props } = useIslandProps({
  onLiveProps: (next, previous) => ({
    ...previous,
    members: next.members
  })
})
```

## Lazy Islands (`defineIslandLoader`)

Code-split islands so their JavaScript is only fetched when the island appears in the DOM:

```tsx
import { defineIslandLoader, bootArchipelagoIslands } from "@archipelago-js/react"

void bootArchipelagoIslands({
  TeamMembers: defineIslandLoader(
    () => import("../islands/TeamMembers"),
    <div>Loading team...</div>  // optional fallback
  )
})
```

The Rails generator supports `--lazy_registry` to scaffold a lazy registry automatically:

```bash
bin/rails generate archipelago:install:react --lazy_registry
```

## Turbo Lifecycle

Archipelago integrates seamlessly with Turbo Drive and Turbo Frames:

- **`turbo:load`** / **`turbo:render`** / **`turbo:frame-load`** — Automatically boots any new `[data-island]` elements added to the page.
- **`turbo:before-cache`** — All mounted islands are unmounted before Turbo caches the page, preventing stale React trees from persisting in the snapshot.
- **MutationObserver** — A DOM observer detects dynamically inserted islands (e.g. from Turbo Streams or manual DOM manipulation) and boots them automatically.

No extra configuration is needed. Just call `bootArchipelagoIslands(registry)` once in your entry file.

## Error Handling

### `FORM_ERROR`

The `@archipelago-js/client` package exports a `FORM_ERROR` constant (`"_base"`) for base-level form errors:

```tsx
import { FORM_ERROR } from "@archipelago-js/client"

{form.errors[FORM_ERROR]?.map((e) => <p key={e}>{e}</p>)}
```

### `ArchipelagoTransportError`

Network failures, HTML responses, and JSON parse errors are wrapped in `ArchipelagoTransportError` (also exported from `@archipelago-js/client`). The form hook captures these into `form.transportError`.

### `ErrorBoundary`

Each island is wrapped in an `ErrorBoundary`. If an island crashes, the error is contained and other islands continue to function.

## API Reference

| Export                        | Package  | Description                              |
|-------------------------------|----------|------------------------------------------|
| `bootArchipelagoIslands`      | react    | Mount all `[data-island]` elements       |
| `unmountArchipelagoIslands`   | react    | Tear down all mounted islands            |
| `defineIslandLoader`          | react    | Create a lazy-loaded registry entry      |
| `useIslandProps`              | react    | Read/subscribe to island props           |
| `useIslandForm`               | react    | Controlled form state and submission     |
| `IslandForm`                  | react    | Declarative form component               |
| `IslandProvider`              | react    | Context provider (used internally)       |
| `useIslandContext`            | react    | Access raw island context                |
| `ErrorBoundary`               | react    | Per-island error boundary                |
| `islandFetch`                 | client   | Low-level island RPC call                |
| `FORM_ERROR`                  | client   | `"_base"` constant for base errors       |
| `ArchipelagoTransportError`   | client   | Typed transport error class              |
| `parseIslandResponse`         | client   | Parse raw JSON into typed response       |
