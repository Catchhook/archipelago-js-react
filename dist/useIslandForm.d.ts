type SubmitOverrides = {
    payload?: Record<string, unknown>;
    navigate?: (location: string) => void;
};
export interface UseIslandFormOptions<TData extends Record<string, unknown>> {
    initialData: TData;
    clearFieldErrorsOnChange?: boolean;
    fixedParams?: Record<string, unknown>;
}
export declare function useIslandForm<TData extends Record<string, unknown>>({ initialData, clearFieldErrorsOnChange, fixedParams }: UseIslandFormOptions<TData>): {
    data: TData;
    setData: <K extends keyof TData>(field: K, value: TData[K]) => void;
    errors: Record<string, string[]>;
    processing: boolean;
    post: (operation: string, overrides?: SubmitOverrides) => Promise<import("@archipelago-js/client").IslandResponse | undefined>;
    put: (operation: string, overrides?: SubmitOverrides) => Promise<import("@archipelago-js/client").IslandResponse | undefined>;
    patch: (operation: string, overrides?: SubmitOverrides) => Promise<import("@archipelago-js/client").IslandResponse | undefined>;
    delete: (operation: string, overrides?: SubmitOverrides) => Promise<import("@archipelago-js/client").IslandResponse | undefined>;
    reset: () => void;
};
export {};
