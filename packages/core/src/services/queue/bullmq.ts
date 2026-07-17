import { type Job, Queue, Worker, type WorkerOptions } from "bullmq";
import type { QueueJob, QueueLike, QueueName, QueueService } from "./base";

export class BullMQQueueService implements QueueService {
    private queues = new Map<QueueName, Queue>();

    constructor(private readonly redisUrl: string) {}

    getQueue<TData = unknown>(queueName: QueueName): QueueLike<TData> {
        if (!this.queues.has(queueName)) {
            const queue = new Queue(queueName, {
                connection: {
                    url: this.redisUrl,
                },
            });
            this.queues.set(queueName, queue);
        }

        return this.queues.get(queueName) as QueueLike<TData>;
    }

    createWorker<TData = unknown, TResult = unknown>(
        queueName: QueueName,
        processor: (job: QueueJob<TData, TResult>) => Promise<TResult>,
        options?: Omit<WorkerOptions, "connection">,
    ): Worker<TData, TResult> {
        return new Worker<TData, TResult>(
            queueName,
            (job: Job<TData, TResult>) => processor(job),
            {
                connection: {
                    url: this.redisUrl,
                },
                ...options,
            },
        );
    }
}

export { BullMQQueueService as QueueManager };
