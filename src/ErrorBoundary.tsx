import React from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error): void {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      // Per-island crash visibility without breaking sibling islands.
      console.error("Archipelago island crashed", error)
    }
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <div data-archipelago-error="true">Island failed to render</div>
    }

    return this.props.children
  }
}
