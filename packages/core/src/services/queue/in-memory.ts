import type {
    QueueJob,
    QueueLike,
    QueueName,
    QueueService,
    WorkerLike,
} from "./base";

export type InMemoryQueueMode = "manual" | "inline";

export class InMemoryQueueService implements QueueService {
    private queues = new Map<QueueName, InMemoryQueue<unknown>>();
    private workers = new Map<QueueName, InMemoryWorker<unknown, unknown>[]>();

    constructor(private readonly mode: InMemoryQueueMode = "manual") {}

    getQueue<TData = unknown>(queueName: QueueName): InMemoryQueue<TData> {
        if (!this.queues.has(queueName)) {
            this.queues.set(
                queueName,
                new InMemoryQueue(queueName, this.mode, this.workers),
            );
        }

        return this.queues.get(queueName) as InMemoryQueue<TData>;
    }

    createWorker<TData = unknown, TResult = unknown>(
        queueName: QueueName,
        processor: (job: QueueJob<TData, TResult>) => Promise<TResult>,
    ): InMemoryWorker<TData, TResult> {
        const worker = new InMemoryWorker(processor);
        const workers = this.workers.get(queueName) ?? [];
        workers.push(worker as InMemoryWorker<unknown, unknown>);
        this.workers.set(queueName, workers);
        return worker;
    }
}

export class InMemoryQueue<TData = unknown> implements QueueLike<TData> {
    private jobs: Array<QueueJob<TData>> = [];
    private nextJobId = 1;

    constructor(
        private readonly queueName: QueueName,
        private readonly mode: InMemoryQueueMode,
        private readonly workers: Map<
            QueueName,
            InMemoryWorker<unknown, unknown>[]
        >,
    ) {}

    async add(name: string, data: TData): Promise<QueueJob<TData>> {
        const job: QueueJob<TData> = {
            id: String(this.nextJobId++),
            name,
            data,
        };

        this.jobs.push(job);

        if (this.mode === "inline") {
            await this.processInline(job);
        }

        return job;
    }

    async getJobs(): Promise<QueueJob<TData>[]> {
        return [...this.jobs];
    }

    clear(): void {
        this.jobs = [];
        this.nextJobId = 1;
    }

    private async processInline(job: QueueJob<TData>) {
        for (const worker of this.workers.get(this.queueName) ?? []) {
            await worker.process(job);
        }
    }
}

class InMemoryWorker<TData, TResult> implements WorkerLike {
    private completedListeners: Array<(job: QueueJob<TData, TResult>) => void> =
        [];
    private failedListeners: Array<
        (job: QueueJob<TData, TResult> | undefined, error: Error) => void
    > = [];
    private errorListeners: Array<(error: Error) => void> = [];

    constructor(
        private readonly processor: (
            job: QueueJob<TData, TResult>,
        ) => Promise<TResult>,
    ) {}

    on(event: "completed", listener: (job: QueueJob) => void): this;
    on(
        event: "failed",
        listener: (job: QueueJob | undefined, error: Error) => void,
    ): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(
        event: "completed" | "failed" | "error",
        listener:
            | ((job: QueueJob) => void)
            | ((job: QueueJob | undefined, error: Error) => void)
            | ((error: Error) => void),
    ): this {
        if (event === "completed") {
            this.completedListeners.push(
                listener as (job: QueueJob<TData, TResult>) => void,
            );
        }
        if (event === "failed") {
            this.failedListeners.push(
                listener as (
                    job: QueueJob<TData, TResult> | undefined,
                    error: Error,
                ) => void,
            );
        }
        if (event === "error") {
            this.errorListeners.push(listener as (error: Error) => void);
        }
        return this;
    }

    async close(): Promise<void> {}

    async process(job: QueueJob<TData, TResult>): Promise<void> {
        try {
            job.returnvalue = await this.processor(job);
            for (const listener of this.completedListeners) {
                listener(job);
            }
        } catch (error) {
            const normalizedError =
                error instanceof Error ? error : new Error(String(error));
            job.failedReason = normalizedError.message;

            for (const listener of this.failedListeners) {
                listener(job, normalizedError);
            }
            for (const listener of this.errorListeners) {
                listener(normalizedError);
            }
        }
    }
}
