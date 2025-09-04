import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create permissions
    const permissions = [
        // User management
        { name: "user.read", description: "View users", category: "user" },
        {
            name: "user.write",
            description: "Create and edit users",
            category: "user",
        },
        { name: "user.delete", description: "Delete users", category: "user" },
        {
            name: "user.manage_roles",
            description: "Assign roles to users",
            category: "user",
        },

        // Event management
        { name: "event.read", description: "View events", category: "event" },
        {
            name: "event.write",
            description: "Create and edit events",
            category: "event",
        },
        {
            name: "event.delete",
            description: "Delete events",
            category: "event",
        },
        {
            name: "event.manage_registrations",
            description: "Manage event registrations",
            category: "event",
        },

        // Group management
        { name: "group.read", description: "View groups", category: "group" },
        {
            name: "group.write",
            description: "Create and edit groups",
            category: "group",
        },
        {
            name: "group.delete",
            description: "Delete groups",
            category: "group",
        },
        {
            name: "group.manage_members",
            description: "Manage group members",
            category: "group",
        },

        // News management
        { name: "news.read", description: "View news", category: "news" },
        {
            name: "news.write",
            description: "Create and edit news",
            category: "news",
        },
        { name: "news.delete", description: "Delete news", category: "news" },

        // Job post management
        {
            name: "jobpost.read",
            description: "View job posts",
            category: "jobpost",
        },
        {
            name: "jobpost.write",
            description: "Create and edit job posts",
            category: "jobpost",
        },
        {
            name: "jobpost.delete",
            description: "Delete job posts",
            category: "jobpost",
        },

        // Admin permissions
        {
            name: "admin.full_access",
            description: "Full administrative access",
            category: "admin",
        },
        {
            name: "admin.view_logs",
            description: "View system logs",
            category: "admin",
        },
        {
            name: "admin.manage_permissions",
            description: "Manage roles and permissions",
            category: "admin",
        },
    ];

    const createdPermissions = await Promise.all(
        permissions.map((permission) =>
            prisma.permission.upsert({
                where: { name: permission.name },
                update: permission,
                create: permission,
            }),
        ),
    );

    console.log(`✅ Created ${createdPermissions.length} permissions`);

    // Create roles
    const roles = [
        {
            name: "Admin",
            description: "Full system administrator",
            color: "#ff0000",
            position: 0,
            permissions: [
                "admin.full_access",
                "admin.view_logs",
                "admin.manage_permissions",
                "user.read",
                "user.write",
                "user.delete",
                "user.manage_roles",
                "event.read",
                "event.write",
                "event.delete",
                "event.manage_registrations",
                "group.read",
                "group.write",
                "group.delete",
                "group.manage_members",
                "news.read",
                "news.write",
                "news.delete",
                "jobpost.read",
                "jobpost.write",
                "jobpost.delete",
            ],
        },
        {
            name: "Moderator",
            description: "Content moderator",
            color: "#00ff00",
            position: 10,
            permissions: [
                "user.read",
                "event.read",
                "event.write",
                "event.manage_registrations",
                "group.read",
                "group.write",
                "group.manage_members",
                "news.read",
                "news.write",
                "jobpost.read",
                "jobpost.write",
            ],
        },
        {
            name: "Event Manager",
            description: "Can manage events",
            color: "#0000ff",
            position: 20,
            permissions: [
                "event.read",
                "event.write",
                "event.manage_registrations",
                "user.read",
            ],
        },
        {
            name: "Member",
            description: "Regular member",
            color: "#888888",
            position: 100,
            permissions: [
                "event.read",
                "group.read",
                "news.read",
                "jobpost.read",
            ],
        },
    ];

    for (const roleData of roles) {
        const { permissions: rolePermissions, ...roleInfo } = roleData;

        // Create or update the role
        const role = await prisma.role.upsert({
            where: { name: roleData.name },
            update: roleInfo,
            create: roleInfo,
        });

        // Connect permissions to the role
        const permissionIds = await prisma.permission.findMany({
            where: { name: { in: rolePermissions } },
            select: { id: true },
        });

        // Clear existing permissions for this role and add new ones
        await prisma.rolePermission.deleteMany({
            where: { roleId: role.id },
        });

        await prisma.rolePermission.createMany({
            data: permissionIds.map((permission) => ({
                roleId: role.id,
                permissionId: permission.id,
            })),
        });

        console.log(
            `✅ Created role: ${role.name} with ${permissionIds.length} permissions`,
        );
    }

    console.log("🎉 Seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
