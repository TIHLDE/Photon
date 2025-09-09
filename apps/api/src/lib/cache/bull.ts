import Queue from "bull";
import { env } from "~/lib/env";

type QueueName = string;

export interface BullJob<T> {
    data: T;
}

type QueueLike<JobData, Result = unknown> = {
    add: (data: JobData, opts?: unknown) => Promise<unknown>;
    process: (
        concurrency: number,
        handler: (job: BullJob<JobData>) => Result | Promise<Result>,
    ) => unknown;
    close: () => Promise<void>;
};

/**
 * Singleton registry of Bull queues so we don't create multiple instances
 * for the same queue name during hot reloads.
 */
const queueRegistry = new Map<QueueName, unknown>();

/**
 * Create or get a Bull queue using the shared REDIS_URL.
 *
 * Bull v4 uses ioredis internally. Passing a connection string is supported.
 */
export function getQueue<T = unknown, R = unknown>(
    name: QueueName,
): QueueLike<T, R> {
    const existing = queueRegistry.get(name) as QueueLike<T, R> | undefined;
    if (existing) return existing;

    const instance = new Queue(name, env.REDIS_URL, {
        // We can tune Bull settings here if needed
        // prefix: "bull",
        // defaultJobOptions: { removeOnComplete: true, removeOnFail: true },
    }) as unknown as QueueLike<T, R>;

    queueRegistry.set(name, instance as unknown);
    return instance;
}

/**
 * Add a job to a named queue.
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
 */
export async function closeAllQueues(): Promise<void> {
    const queues = Array.from(queueRegistry.values()) as Array<
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
    queueRegistry.clear();
}
