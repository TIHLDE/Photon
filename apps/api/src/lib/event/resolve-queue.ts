import {
    REGISTRATION_QUEUE_NAME,
    type QueueJob,
    type WorkerLike,
} from "@photon/core/services/queue";
import type { AppContext } from "../ctx";
import { resolveRegistrationsForEvent } from "./resolve-registration";

export type RegistrationResolveJobData = {
    eventId: string;
};

/**
 * Ask for an event's pending registrations to be resolved now, instead of
 * waiting for the next tick of the cron in `lib/jobs.ts`.
 *
 * A member who presses "Meld deg på" would otherwise sit on "Behandler
 * påmeldingen din …" for whatever was left of the 5-second tick — 2.5 seconds
 * on average, for work that takes milliseconds.
 *
 * The queue, rather than a floating promise in the request handler, for two
 * reasons. The request must not hold a database connection while queueing
 * behind the resolver's `FOR UPDATE` lock — a stampede of blocked requests is
 * what exhausts the pool. And background work that outlives the request has
 * nothing to keep it in check: in the test suite it kept issuing queries into
 * a database that had already been torn down, and spun until the run was
 * killed. A job has an owner, a retry, and a worker whose lifetime is the
 * process's.
 *
 * Enqueueing is best-effort on purpose. If Redis is unreachable the
 * registration must still stand — the cron picks it up within five seconds,
 * which is exactly where we were before.
 */
export async function enqueueRegistrationResolve(
    eventId: string,
    ctx: AppContext,
): Promise<void> {
    try {
        await ctx.queue
            .getQueue<RegistrationResolveJobData>(REGISTRATION_QUEUE_NAME)
            .add("resolve-registrations", { eventId });
    } catch (error) {
        console.error(
            `Could not enqueue registration resolve for event ${eventId}, leaving it to the cron:`,
            error,
        );
    }
}

/**
 * Runs the resolver for whatever {@link enqueueRegistrationResolve} asked for.
 *
 * Jobs are processed one at a time, so the registrations that pile in when
 * sign-up opens are resolved in a couple of passes over the whole batch rather
 * than one transaction per member all queueing on the same lock. A pass for an
 * event with nothing pending costs a single indexed lookup, so duplicate jobs
 * are cheap and need no deduplication.
 */
export function startRegistrationResolveWorker(ctx: AppContext): WorkerLike {
    const worker = ctx.queue.createWorker<RegistrationResolveJobData, void>(
        REGISTRATION_QUEUE_NAME,
        async (job: QueueJob<RegistrationResolveJobData>) => {
            await resolveRegistrationsForEvent(job.data.eventId, ctx);
        },
    );

    worker.on("failed", (job, err) => {
        console.error(`❌ Registration resolve job ${job?.id} failed:`, err);
    });

    worker.on("error", (err) => {
        console.error("Registration resolve worker error:", err);
    });

    return worker;
}
