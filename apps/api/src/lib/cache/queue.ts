import { type Job, Queue, Worker, type WorkerOptions } from "bullmq";

type QueueName = "registration" | "email";

export class QueueManager {
    private queues = new Map<QueueName, Queue>();
    private redisUrl: string;

    constructor(redisUrl: string) {
        this.redisUrl = redisUrl;
    }

    getQueue(queueName: QueueName): Queue {
        if (!this.queues.has(queueName)) {
            const queue = new Queue(queueName, {
                connection: {
                    url: this.redisUrl,
                },
            });
            this.queues.set(queueName, queue);
        }
        // biome-ignore lint/style/noNonNullAssertion: It cannot be null
        return this.queues.get(queueName)!;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Generic defaults for flexibility
    createWorker<T = any, R = any>(
        queueName: QueueName,
        job: (job: Job<T, R>) => Promise<R>,
        options?: Omit<WorkerOptions, "connection">,
    ): Worker<T, R> {
        return new Worker<T, R>(queueName, job, {
            connection: {
                url: this.redisUrl,
            },
            ...options,
        });
    }
}
