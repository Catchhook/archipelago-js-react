import { type IslandResponse } from "@archipelago-js/client";
type SubmitOverrides = {
    payload?: Record<string, unknown>;
    navigate?: (location: string) => void;
};
export interface UseIslandFormCallbacks<TData extends Record<string, unknown>> {
    onSuccess?: (response: IslandResponse) => void;
    onError?: (response: IslandResponse) => void;
    onForbidden?: (response: IslandResponse) => void;
    onFinish?: (response: IslandResponse | undefined) => void;
}
export interface UseIslandFormOptions<TData extends Record<string, unknown>> extends UseIslandFormCallbacks<TData> {
    initialData: TData;
    clearFieldErrorsOnChange?: boolean;
    fixedParams?: Record<string, unknown>;
    recentlySuccessfulDuration?: number;
    transform?: (payload: TData) => Record<string, unknown>;
}
export type UploadProgress = {
    percentage: number;
};
export declare function useIslandForm<TData extends Record<string, unknown>>({ initialData, clearFieldErrorsOnChange, fixedParams, recentlySuccessfulDuration, transform, onSuccess, onError, onForbidden, onFinish }: UseIslandFormOptions<TData>): {
    data: TData;
    setData: <K extends keyof TData>(field: K, value: TData[K]) => void;
    errors: Record<string, string[]>;
    setError: (field: keyof TData | string, message: string | string[]) => void;
    clearErrors: (...fields: (keyof TData)[]) => void;
    processing: boolean;
    wasSuccessful: boolean;
    recentlySuccessful: boolean;
    progress: UploadProgress | null;
    transportError: Error | null;
    defaults: (...args: [] | [Partial<TData>] | [keyof TData, TData[keyof TData]]) => TData;
    reset: (...fields: (keyof TData)[]) => void;
    resetAndClearErrors: (...fields: (keyof TData)[]) => void;
    post: (operation: string, overrides?: SubmitOverrides) => Promise<IslandResponse | undefined>;
    put: (operation: string, overrides?: SubmitOverrides) => Promise<IslandResponse | undefined>;
    patch: (operation: string, overrides?: SubmitOverrides) => Promise<IslandResponse | undefined>;
    delete: (operation: string, overrides?: SubmitOverrides) => Promise<IslandResponse | undefined>;
};
export {};
