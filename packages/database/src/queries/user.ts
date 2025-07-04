import { prisma } from "../client";

export const getUserById = async (id: string) => {
    return await prisma.user.findUnique({
        where: { id },
    });
};

export const getUserWithRolesById = async (id: string) => {
    return await prisma.user.findUnique({
        where: { id },
        include: {
            userRoles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
};
