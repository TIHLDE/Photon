export {
    BaseEmailService,
    type ContentOptions,
    type EmailService,
    type SendOptions,
} from "./base";
export { ConsoleEmailService } from "./log-based";
export { SMTPEmailService } from "./smtp";
export {
    startQueuedEmailWorker,
    QueuedEmailService,
    type EmailQueueJobData,
} from "./queue-based";
