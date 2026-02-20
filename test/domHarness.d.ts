import React from "react";
export type RenderHarness = {
    container: HTMLElement;
    getByTestId: (id: string) => HTMLElement;
    unmount: () => Promise<void>;
};
export declare function renderReact(node: React.ReactNode): Promise<RenderHarness>;
export declare function click(element: HTMLElement): Promise<void>;
export declare function changeInput(element: HTMLElement, value: string): Promise<void>;
export declare function waitForExpectation(assertion: () => void, options?: {
    timeoutMs?: number;
    intervalMs?: number;
}): Promise<void>;
