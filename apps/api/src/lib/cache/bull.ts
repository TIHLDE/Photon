import Queue from "bull";
import { env } from "~/lib/env";

type QueueName = string;

export interface BullJob<T> {
    data: T;
}

export type QueueLike<JobData, Result = unknown> = {
    add: (data: JobData, opts?: unknown) => Promise<unknown>;
    process: (
        concurrency: number,
        handler: (job: BullJob<JobData>) => Result | Promise<Result>,
    ) => unknown;
    close: () => Promise<void>;
};

/**
 * Queue manager class that manages Bull queues for a specific Redis instance.
 * This allows for dependency injection and testing with different Redis instances.
 */
export class BullQueueManager {
    private queueRegistry = new Map<QueueName, unknown>();

    constructor(private redisUrl: string) {}

    /**
     * Create or get a Bull queue using the configured REDIS_URL.
     */
    getQueue<T = unknown, R = unknown>(name: QueueName): QueueLike<T, R> {
        const existing = this.queueRegistry.get(name) as
            | QueueLike<T, R>
            | undefined;
        if (existing) return existing;

        const instance = new Queue(name, this.redisUrl, {
            // We can tune Bull settings here if needed
            // prefix: "bull",
            // defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
        }) as unknown as QueueLike<T, R>;

        this.queueRegistry.set(name, instance as unknown);
        return instance;
    }

    /**
     * Add a job to a named queue.
     */
    async enqueue<T = unknown>(
        queueName: QueueName,
        data: T,
        opts?: unknown,
    ): Promise<unknown> {
        const queue = this.getQueue<T>(queueName);
        return queue.add(data, opts);
    }

    /**
     * Register a processor for a named queue.
     */
    processQueue<T = unknown, R = unknown>(
        queueName: QueueName,
        handler: (job: BullJob<T>) => R | Promise<R>,
        concurrency = 1,
    ): unknown {
        const queue = this.getQueue<T, R>(queueName);
        return queue.process(concurrency, handler);
    }

    /**
     * Gracefully close all queues.
     */
    async closeAll(): Promise<void> {
        const queues = Array.from(this.queueRegistry.values()) as Array<
            QueueLike<unknown>
        >;
        await Promise.all(
            queues.map(async (q) => {
                try {
                    await q.close();
                } catch {
                    // ignore
                }
            }),
        );
        this.queueRegistry.clear();
    }
}

/**
 * Factory function to create a queue manager.
 * Use this for dependency injection and testing.
 */
export function createQueueManager(redisUrl: string): BullQueueManager {
    return new BullQueueManager(redisUrl);
}

/**
 * Singleton queue registry for backward compatibility.
 * Prefer using createQueueManager() and dependency injection in new code.
 */
const globalQueueRegistry = new Map<QueueName, unknown>();

/**
 * Create or get a Bull queue using the shared REDIS_URL.
 *
 * @deprecated Use createQueueManager() and dependency injection instead
 */
export function getQueue<T = unknown, R = unknown>(
    name: QueueName,
): QueueLike<T, R> {
    const existing = globalQueueRegistry.get(name) as
        | QueueLike<T, R>
        | undefined;
    if (existing) return existing;

    const instance = new Queue(name, env.REDIS_URL, {
        // We can tune Bull settings here if needed
        // prefix: "bull",
        // defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
    }) as unknown as QueueLike<T, R>;

    globalQueueRegistry.set(name, instance as unknown);
    return instance;
}

/**
 * Add a job to a named queue.
 *
 * @deprecated Use createQueueManager() and dependency injection instead
 */
export async function enqueue<T = unknown>(
    queueName: QueueName,
    data: T,
    opts?: unknown,
) {
    const queue = getQueue<T>(queueName);
    return queue.add(data, opts);
}

/**
 * Register a processor for a named queue.
 *
 * @deprecated Use createQueueManager() and dependency injection instead
 */
export function processQueue<T = unknown, R = unknown>(
    queueName: QueueName,
    handler: (job: BullJob<T>) => R | Promise<R>,
    concurrency = 1,
) {
    const queue = getQueue<T, R>(queueName);
    return queue.process(concurrency, handler);
}

/**
 * Gracefully close all queues.
 *
 * @deprecated Use createQueueManager() and dependency injection instead
 */
export async function closeAllQueues(): Promise<void> {
    const queues = Array.from(globalQueueRegistry.values()) as Array<
        QueueLike<unknown>
    >;
    await Promise.all(
        queues.map(async (q) => {
            try {
                await q.close();
            } catch {
                // ignore
            }
        }),
    );
    globalQueueRegistry.clear();
}
