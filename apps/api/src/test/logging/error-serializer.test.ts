import { describe, expect, test } from "vitest";
import { serializeError } from "~/lib/logger";

function uniqueViolation(): Error {
    return Object.assign(
        new Error(
            'duplicate key value violates unique constraint "auth_user_email_unique"',
        ),
        {
            name: "error",
            severity: "ERROR",
            code: "23505",
            detail: "Key (email)=(ola@eksempel.no) already exists.",
            schema: "public",
            table: "auth_user",
            constraint: "auth_user_email_unique",
            file: "nbtinsert.c",
            routine: "_bt_check_unique",
        },
    );
}

describe("serializeError", () => {
    test("drops the Postgres fields that carry the conflicting values", () => {
        const serialized = serializeError(uniqueViolation());

        expect(JSON.stringify(serialized)).not.toContain("ola@eksempel.no");
        expect(serialized).not.toHaveProperty("detail");
        expect(serialized).not.toHaveProperty("schema");
        expect(serialized).not.toHaveProperty("routine");
    });

    test("keeps what a debugger needs", () => {
        expect(serializeError(uniqueViolation())).toMatchObject({
            type: "Error",
            message: expect.stringContaining("auth_user_email_unique"),
            code: "23505",
            table: "auth_user",
            constraint: "auth_user_email_unique",
            stack: expect.stringContaining("error-serializer.test.ts"),
        });
    });

    test("drops fields nobody has thought of yet", () => {
        const err = Object.assign(new Error("boom"), {
            phoneNumber: "99887766",
            someFutureField: "ola@eksempel.no",
        });

        expect(serializeError(err)).not.toHaveProperty("phoneNumber");
        expect(JSON.stringify(serializeError(err))).not.toContain(
            "ola@eksempel.no",
        );
    });

    test("applies the same allowlist to a nested cause", () => {
        const err = new Error("wrapper", { cause: uniqueViolation() });

        const serialized = serializeError(err) as { cause: object };
        expect(serialized.cause).toMatchObject({ code: "23505" });
        expect(JSON.stringify(serialized)).not.toContain("ola@eksempel.no");
    });

    test("survives a circular cause chain", () => {
        const a = new Error("a");
        const b = new Error("b", { cause: a });
        (a as Error & { cause?: unknown }).cause = b;

        expect(() => serializeError(a)).not.toThrow();
    });
});
