export type QueueName = "registration" | "email" | "payment";
export const EMAIL_QUEUE_NAME = "email" satisfies QueueName;
export const EMAIL_SEND_RATE_MS = 3000;

export const PAYMENT_QUEUE_NAME = "payment" satisfies QueueName;

/** Options accepted when enqueueing a job. */
export interface QueueAddOptions {
    /** Delay in milliseconds before the job becomes available to a worker. */
    delay?: number;
}

export type QueueJobState =
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed";

export interface QueueJob<TData = unknown, TResult = unknown> {
    id?: string;
    name: string;
    data: TData;
    returnvalue?: TResult;
    failedReason?: string;
}

export interface QueueLike<TData = unknown> {
    add(
        name: string,
        data: TData,
        options?: QueueAddOptions,
    ): Promise<QueueJob<TData>>;
    getJobs(states?: QueueJobState[]): Promise<QueueJob<TData>[]>;
}

export interface WorkerLike {
    on(event: "completed", listener: (job: QueueJob) => void): this;
    on(
        event: "failed",
        listener: (job: QueueJob | undefined, error: Error) => void,
    ): this;
    on(event: "error", listener: (error: Error) => void): this;
    close(): Promise<void>;
}

export interface QueueService {
    getQueue<TData = unknown>(queueName: QueueName): QueueLike<TData>;

    createWorker<TData = unknown, TResult = unknown>(
        queueName: QueueName,
        processor: (job: QueueJob<TData, TResult>) => Promise<TResult>,
        options?: unknown,
    ): WorkerLike;
}
