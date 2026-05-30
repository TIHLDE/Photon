import { type AuthCreateContext, createAuth } from ".";

export default createAuth(
    {
        db: null,
        redis: null,
        mailer: null,
        queue: null,
        bucket: null,
    } as unknown as AuthCreateContext,
    { isDev: true },
);
