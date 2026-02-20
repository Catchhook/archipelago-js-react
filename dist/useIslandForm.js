import { islandFetch } from "@archipelago/client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIslandContext } from "./context";
export function useIslandForm({ initialData, clearFieldErrorsOnChange = true, fixedParams = {} }) {
    const { component, params, stream, setState } = useIslandContext();
    const [data, setDataState] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const requestRef = useRef(null);
    const setData = useCallback((field, value) => {
        setDataState((previous) => ({
            ...previous,
            [field]: value
        }));
        if (clearFieldErrorsOnChange) {
            setErrors((previous) => {
                if (!(field in previous)) {
                    return previous;
                }
                const next = { ...previous };
                delete next[field];
                return next;
            });
        }
    }, [clearFieldErrorsOnChange]);
    const submit = useCallback(async (method, operation, overrides = {}) => {
        requestRef.current?.controller.abort();
        const controller = new AbortController();
        const requestId = (requestRef.current?.id ?? 0) + 1;
        requestRef.current = { id: requestId, controller };
        setProcessing(true);
        const payload = method === "post" ? data : { ...data, _method: method };
        try {
            const response = await islandFetch(component, operation, payload, {
                signal: controller.signal,
                fixedParams: {
                    ...params,
                    ...fixedParams,
                    ...(stream ? { __stream: stream } : {})
                },
                overridePayload: overrides.payload,
                navigate: overrides.navigate
            });
            if (requestRef.current?.id !== requestId) {
                return response;
            }
            if (response.status === "ok") {
                setErrors({});
                setState((previous) => ({
                    props: response.props,
                    version: typeof response.version === "number" && response.version > previous.version
                        ? response.version
                        : previous.version
                }));
            }
            if (response.status === "error") {
                setErrors(response.errors);
            }
            if (response.status === "forbidden") {
                setErrors({ _base: ["forbidden"] });
            }
            return response;
        }
        catch (error) {
            if (error.name === "AbortError") {
                return undefined;
            }
            throw error;
        }
        finally {
            if (requestRef.current?.id === requestId) {
                setProcessing(false);
            }
        }
    }, [component, data, fixedParams, params, setState, stream]);
    const reset = useCallback(() => {
        setDataState(initialData);
        setErrors({});
    }, [initialData]);
    return useMemo(() => {
        return {
            data,
            setData,
            errors,
            processing,
            post: (operation, overrides) => submit("post", operation, overrides),
            put: (operation, overrides) => submit("put", operation, overrides),
            patch: (operation, overrides) => submit("patch", operation, overrides),
            delete: (operation, overrides) => submit("delete", operation, overrides),
            reset
        };
    }, [data, errors, processing, reset, setData, submit]);
}
//# sourceMappingURL=useIslandForm.js.map