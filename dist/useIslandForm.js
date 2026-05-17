import { islandFetch } from "@archipelago-js/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIslandContext } from "./context";
function deepClone(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
export function useIslandForm({ initialData, clearFieldErrorsOnChange = true, fixedParams = {}, recentlySuccessfulDuration = 2000, transform, onSuccess, onError, onForbidden, onFinish }) {
    const { component, params, stream, setState } = useIslandContext();
    const [data, setDataState] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [wasSuccessful, setWasSuccessful] = useState(false);
    const [recentlySuccessful, setRecentlySuccessful] = useState(false);
    const [progress, setProgress] = useState(null);
    const [transportError, setTransportError] = useState(null);
    const requestRef = useRef(null);
    const defaultsRef = useRef(deepClone(initialData));
    const recentlySuccessfulTimerRef = useRef(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (recentlySuccessfulTimerRef.current) {
                clearTimeout(recentlySuccessfulTimerRef.current);
            }
        };
    }, []);
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
    const clearErrors = useCallback((...fields) => {
        if (fields.length === 0) {
            setErrors({});
            return;
        }
        setErrors((previous) => {
            const next = { ...previous };
            for (const field of fields) {
                delete next[field];
            }
            return next;
        });
    }, []);
    const setError = useCallback((field, message) => {
        const messages = Array.isArray(message) ? message : [message];
        setErrors((previous) => ({
            ...previous,
            [field]: messages
        }));
    }, []);
    const defaults = useCallback((...args) => {
        if (args.length === 0) {
            return deepClone(defaultsRef.current);
        }
        if (args.length === 1 && typeof args[0] === "object") {
            defaultsRef.current = deepClone({ ...defaultsRef.current, ...args[0] });
            return defaultsRef.current;
        }
        if (args.length === 2) {
            const [field, value] = args;
            defaultsRef.current = deepClone({ ...defaultsRef.current, [field]: value });
            return defaultsRef.current;
        }
        return deepClone(defaultsRef.current);
    }, []);
    const reset = useCallback((...fields) => {
        if (fields.length === 0) {
            setDataState(deepClone(defaultsRef.current));
            setErrors({});
            return;
        }
        setDataState((previous) => {
            const next = { ...previous };
            for (const field of fields) {
                if (field in defaultsRef.current) {
                    next[field] = deepClone(defaultsRef.current[field]);
                }
            }
            return next;
        });
    }, []);
    const resetAndClearErrors = useCallback((...fields) => {
        reset(...fields);
        clearErrors(...fields);
    }, [reset, clearErrors]);
    const submit = useCallback(async (method, operation, overrides = {}) => {
        requestRef.current?.controller.abort();
        const controller = new AbortController();
        const requestId = (requestRef.current?.id ?? 0) + 1;
        requestRef.current = { id: requestId, controller };
        setProcessing(true);
        setWasSuccessful(false);
        setRecentlySuccessful(false);
        setTransportError(null);
        setProgress(null);
        if (recentlySuccessfulTimerRef.current) {
            clearTimeout(recentlySuccessfulTimerRef.current);
            recentlySuccessfulTimerRef.current = null;
        }
        const rawPayload = method === "post" ? data : { ...data, _method: method };
        const payload = transform ? transform(rawPayload) : rawPayload;
        try {
            const response = await islandFetch(component, operation, payload, {
                signal: controller.signal,
                fixedParams: {
                    ...params,
                    ...fixedParams
                },
                overridePayload: overrides.payload,
                navigate: overrides.navigate,
                stream: stream ?? undefined,
                onUploadProgress: (p) => {
                    if (requestRef.current?.id === requestId && mountedRef.current) {
                        setProgress(p);
                    }
                }
            });
            if (requestRef.current?.id !== requestId) {
                return response;
            }
            if (response.status === "ok") {
                setErrors({});
                setWasSuccessful(true);
                setRecentlySuccessful(true);
                recentlySuccessfulTimerRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        setRecentlySuccessful(false);
                    }
                }, recentlySuccessfulDuration);
                setState((previous) => ({
                    props: response.props,
                    version: typeof response.version === "number" && response.version > previous.version
                        ? response.version
                        : previous.version
                }));
                onSuccess?.(response);
            }
            if (response.status === "redirect") {
                setWasSuccessful(true);
                setRecentlySuccessful(true);
                recentlySuccessfulTimerRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        setRecentlySuccessful(false);
                    }
                }, recentlySuccessfulDuration);
                onSuccess?.(response);
            }
            if (response.status === "error") {
                setErrors(response.errors);
                onError?.(response);
            }
            if (response.status === "forbidden") {
                setErrors({ _base: ["forbidden"] });
                onForbidden?.(response);
            }
            onFinish?.(response);
            return response;
        }
        catch (error) {
            if (error.name === "AbortError") {
                return undefined;
            }
            if (requestRef.current?.id === requestId) {
                setTransportError(error instanceof Error ? error : new Error(String(error)));
            }
            onFinish?.(undefined);
            return undefined;
        }
        finally {
            if (requestRef.current?.id === requestId) {
                setProcessing(false);
                setProgress(null);
            }
        }
    }, [
        component,
        data,
        fixedParams,
        onError,
        onFinish,
        onForbidden,
        onSuccess,
        params,
        recentlySuccessfulDuration,
        setState,
        stream,
        transform
    ]);
    return useMemo(() => {
        return {
            data,
            setData,
            errors,
            setError,
            clearErrors,
            processing,
            wasSuccessful,
            recentlySuccessful,
            progress,
            transportError,
            defaults,
            reset,
            resetAndClearErrors,
            post: (operation, overrides) => submit("post", operation, overrides),
            put: (operation, overrides) => submit("put", operation, overrides),
            patch: (operation, overrides) => submit("patch", operation, overrides),
            delete: (operation, overrides) => submit("delete", operation, overrides)
        };
    }, [
        clearErrors,
        data,
        defaults,
        errors,
        processing,
        progress,
        recentlySuccessful,
        reset,
        resetAndClearErrors,
        setData,
        setError,
        submit,
        transportError,
        wasSuccessful
    ]);
}
//# sourceMappingURL=useIslandForm.js.map