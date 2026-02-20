import { type CableConsumer } from "./actionCable";
export interface UseIslandPropsOptions {
    stream?: string;
    onLiveProps?: (next: Record<string, unknown>, previous: Record<string, unknown>) => Record<string, unknown>;
    consumer?: CableConsumer;
}
export declare function useIslandProps(options?: UseIslandPropsOptions): {
    props: Record<string, unknown>;
    setProps: (next: Record<string, unknown>) => void;
    version: number;
};
