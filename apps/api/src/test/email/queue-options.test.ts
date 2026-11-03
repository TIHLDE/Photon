import {
    type EmailQueueJobData,
    QueuedEmailService,
} from "@photon/core/services/email";
import type {
    QueueAddOptions,
    QueueService,
} from "@photon/core/services/queue";
import { describe, expect, it, vi } from "vitest";

const EXPECTED: QueueAddOptions = {
    attempts: 6,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: true,
    removeOnFail: true,
};

function fakeQueueService() {
    const add = vi.fn().mockResolvedValue({ name: "send-email", data: {} });
    const addBulk = vi.fn().mockResolvedValue([]);
    const service = {
        getQueue: () => ({ add, addBulk, getJobs: async () => [] }),
    } as unknown as QueueService;
    return { add, addBulk, service };
}

const email = {
    options: { to: "member@test.tihlde.org" },
    content: { subject: "Nullstill passord", html: "<p>lenke</p>" },
} as unknown as EmailQueueJobData;

describe("email queue jobs", () => {
    it("are retried and removed from Redis when sent one at a time", async () => {
        const { add, service } = fakeQueueService();

        await new QueuedEmailService(service).sendRawEmail(
            email.options,
            email.content,
        );

        expect(add).toHaveBeenCalledWith("send-email", email, EXPECTED);
    });

    it("are retried and removed from Redis when sent as a batch", async () => {
        const { addBulk, service } = fakeQueueService();

        await new QueuedEmailService(service).sendRawEmails([email]);

        expect(addBulk).toHaveBeenCalledWith([
            { name: "send-email", data: email, opts: EXPECTED },
        ]);
    });
});
