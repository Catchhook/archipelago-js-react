import React from "react";
export type IslandComponent = React.ComponentType;
export type IslandLoader = () => Promise<{
    default: IslandComponent;
} | IslandComponent>;
export type IslandRegistryEntry = IslandComponent | {
    load: IslandLoader;
    fallback?: React.ReactNode;
};
export type IslandRegistry = Record<string, IslandRegistryEntry>;
export declare function bootArchipelagoIslands(registry: IslandRegistry): Promise<void>;
export declare function unmountArchipelagoIslands(): void;
export declare function defineIslandLoader(load: IslandLoader, fallback?: React.ReactNode): IslandRegistryEntry;
