import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from "react";
const IslandContext = createContext(null);
export function IslandProvider({ children, component, params, instance, stream, initialProps = {}, initialVersion = 0 }) {
    const [state, setState] = useState({
        props: initialProps,
        version: initialVersion
    });
    const value = useMemo(() => {
        return {
            component,
            params,
            instance,
            stream,
            state,
            setState
        };
    }, [component, instance, params, state, stream]);
    return _jsx(IslandContext.Provider, { value: value, children: children });
}
export function useIslandContext() {
    const value = useContext(IslandContext);
    if (!value) {
        throw new Error("useIslandContext must be used inside IslandProvider");
    }
    return value;
}
//# sourceMappingURL=context.js.map