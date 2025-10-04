import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@socotra/modelcontextprotocol-sdk/server/mcp.js";
import type { UserWithRole } from "better-auth/plugins/admin";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { route } from "../lib/route";

export const mcpRoute = route().all("/mcp", async (c) => {
    const { auth } = c.get("ctx");
    const transport = new StreamableHTTPTransport();

    // Your MCP server implementation
    const mcpServer = new McpServer({
        name: "testing-mcp-server",
        version: "1.0.0",
    });

    // Tool for getting test users
    mcpServer.registerTool(
        "get_test_user",
        {
            description:
                "Retrieves or creates a test user for API testing. Users are generated on demand and provide credentials for testing API requests in local development.",
            inputSchema: {
                type: z.enum(["admin", "regular"]),
            },
        },
        async (args) => {
            const type = args.type;

            const roleMap = {
                admin: "admin",
                regular: "user",
            } as const;

            const email = `user-${type}-123@test.com`;
            const password = "abc123!";

            // Check if user already exists
            const existingUser = await db.query.user.findFirst({
                where: eq(schema.user.email, email),
            });

            let user: UserWithRole;
            if (existingUser) {
                user = {
                    ...existingUser,
                    role: existingUser.role ?? undefined,
                };
            } else {
                const result = await auth.api.createUser({
                    body: {
                        email,
                        name: type.charAt(0).toUpperCase() + type.slice(1),
                        password,
                        role: roleMap[type] || "user",
                    },
                });
                user = result.user;
            }

            await db.update(schema.user).set({
                emailVerified: true,
            });

            const { token } = await auth.api.signInEmail({
                body: {
                    email,
                    password,
                },
            });

            const filteredUser = {
                id: user.id,
                email: user.email,
                password,
                name: user.name,
                createdAt: user.createdAt.toString().split(" GMT")[0],
                token,
            };

            const userMarkdown = `| Property | Value |\n|----------|-------|\n${Object.entries(
                filteredUser,
            )
                .map(([key, value]) => `| ${key} | ${value} |`)
                .join("\n")}`;

            return {
                content: [
                    {
                        type: "text",
                        text: userMarkdown,
                    },
                ],
            };
        },
    );

    await mcpServer.connect(transport);
    return transport.handleRequest(c);
});
