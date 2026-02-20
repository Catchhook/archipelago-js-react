import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error) {
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
            // Per-island crash visibility without breaking sibling islands.
            console.error("Archipelago island crashed", error);
        }
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? _jsx("div", { "data-archipelago-error": "true", children: "Island failed to render" });
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map