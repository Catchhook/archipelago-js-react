import React from "react";
type IslandState = {
    props: Record<string, unknown>;
    version: number;
};
export interface IslandContextValue {
    component: string;
    params: Record<string, unknown>;
    instance?: string;
    stream?: string;
    state: IslandState;
    setState: React.Dispatch<React.SetStateAction<IslandState>>;
}
export interface IslandProviderProps {
    children: React.ReactNode;
    component: string;
    params: Record<string, unknown>;
    instance?: string;
    stream?: string;
    initialProps?: Record<string, unknown>;
    initialVersion?: number;
}
export declare function IslandProvider({ children, component, params, instance, stream, initialProps, initialVersion }: IslandProviderProps): React.ReactElement;
export declare function useIslandContext(): IslandContextValue;
export {};
