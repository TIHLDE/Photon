import { prisma } from "../client";
import type { EventStatus, RegistrationStatus } from "../../generated/prisma";

export type CreateEventData = {
    title: string;
    description: string;
    startDate: Date;
    endDate?: Date;
    location?: string;
    maxParticipants?: number;
    registrationStart?: Date;
    registrationEnd?: Date;
    status?: EventStatus;
    organizerId: string;
};

export type UpdateEventData = Partial<CreateEventData>;

export type EventsQueryOptions = {
    page?: number;
    limit?: number;
    status?: EventStatus;
    search?: string;
    organizerId?: string;
    upcoming?: boolean;
    userId?: string;
};

export const createEvent = async (data: CreateEventData) => {
    return await prisma.event.create({
        data,
        include: {
            organizer: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
            _count: {
                select: {
                    registrations: {
                        where: { status: "REGISTERED" },
                    },
                },
            },
        },
    });
};

export const updateEvent = async (id: string, data: UpdateEventData) => {
    return await prisma.event.update({
        where: { id },
        data,
        include: {
            organizer: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
            _count: {
                select: {
                    registrations: {
                        where: { status: "REGISTERED" },
                    },
                },
            },
        },
    });
};

export const deleteEvent = async (id: string) => {
    return await prisma.event.delete({
        where: { id },
    });
};

export const getEventById = async (id: string, userId?: string) => {
    const event = await prisma.event.findUnique({
        where: { id },
        include: {
            organizer: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
            _count: {
                select: {
                    registrations: {
                        where: { status: "REGISTERED" },
                    },
                },
            },
            registrations: userId
                ? {
                      where: { userId },
                      take: 1,
                      select: {
                          id: true,
                          status: true,
                          createdAt: true,
                      },
                  }
                : false,
        },
    });

    if (!event) return null;

    // Add waitlisted count manually since Prisma doesn't support multiple conditional counts in _count
    const waitlistedCount = await prisma.eventRegistration.count({
        where: {
            eventId: id,
            status: "WAITLISTED",
        },
    });

    return {
        ...event,
        _count: {
            ...event._count,
            waitlistedRegistrations: waitlistedCount,
        },
        userRegistration: event.registrations?.[0] || null,
    };
};

export const getEvents = async (options: EventsQueryOptions = {}) => {
    const {
        page = 1,
        limit = 20,
        status,
        search,
        organizerId,
        upcoming,
        userId,
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
        where.status = status;
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
        ];
    }

    if (organizerId) {
        where.organizerId = organizerId;
    }

    if (upcoming) {
        where.startDate = { gte: new Date() };
    }

    const [events, total] = await Promise.all([
        prisma.event.findMany({
            where,
            skip,
            take: limit,
            orderBy: { startDate: "asc" },
            include: {
                organizer: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                    },
                },
                _count: {
                    select: {
                        registrations: {
                            where: { status: "REGISTERED" },
                        },
                    },
                },
                registrations: userId
                    ? {
                          where: { userId },
                          take: 1,
                          select: {
                              id: true,
                              status: true,
                              createdAt: true,
                          },
                      }
                    : false,
            },
        }),
        prisma.event.count({ where }),
    ]);

    // Add waitlisted counts for all events
    const eventsWithWaitlistCounts = await Promise.all(
        events.map(async (event) => {
            const waitlistedCount = await prisma.eventRegistration.count({
                where: {
                    eventId: event.id,
                    status: "WAITLISTED",
                },
            });

            return {
                ...event,
                _count: {
                    ...event._count,
                    waitlistedRegistrations: waitlistedCount,
                },
                userRegistration: event.registrations?.[0] || null,
            };
        }),
    );

    return {
        data: eventsWithWaitlistCounts,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const registerForEvent = async (
    eventId: string,
    userId: string,
    notes?: string,
) => {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            _count: {
                select: {
                    registrations: {
                        where: { status: "REGISTERED" },
                    },
                },
            },
        },
    });

    if (!event) {
        throw new Error("Event not found");
    }

    // Check if registration is open
    const now = new Date();
    if (event.registrationStart && now < event.registrationStart) {
        throw new Error("Registration has not started yet");
    }
    if (event.registrationEnd && now > event.registrationEnd) {
        throw new Error("Registration has ended");
    }

    // Check if user is already registered
    const existingRegistration = await prisma.eventRegistration.findUnique({
        where: {
            eventId_userId: {
                eventId,
                userId,
            },
        },
    });

    if (existingRegistration) {
        throw new Error("User is already registered for this event");
    }

    // Determine registration status based on capacity
    const isAtCapacity = event.maxParticipants
        ? event._count.registrations >= event.maxParticipants
        : false;

    const status: RegistrationStatus = isAtCapacity
        ? "WAITLISTED"
        : "REGISTERED";

    return await prisma.eventRegistration.create({
        data: {
            eventId,
            userId,
            status,
            notes,
        },
        include: {
            event: {
                select: {
                    title: true,
                },
            },
        },
    });
};

export const unregisterFromEvent = async (eventId: string, userId: string) => {
    const registration = await prisma.eventRegistration.findUnique({
        where: {
            eventId_userId: {
                eventId,
                userId,
            },
        },
    });

    if (!registration) {
        throw new Error("Registration not found");
    }

    await prisma.eventRegistration.delete({
        where: {
            eventId_userId: {
                eventId,
                userId,
            },
        },
    });

    // If this was a registered user, promote someone from waitlist
    if (registration.status === "REGISTERED") {
        const nextInWaitlist = await prisma.eventRegistration.findFirst({
            where: {
                eventId,
                status: "WAITLISTED",
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        if (nextInWaitlist) {
            await prisma.eventRegistration.update({
                where: { id: nextInWaitlist.id },
                data: { status: "REGISTERED" },
            });
        }
    }

    return { success: true };
};

export const getUserEventRegistration = async (
    eventId: string,
    userId: string,
) => {
    return await prisma.eventRegistration.findUnique({
        where: {
            eventId_userId: {
                eventId,
                userId,
            },
        },
        include: {
            event: {
                select: {
                    title: true,
                    startDate: true,
                },
            },
        },
    });
};

export const getEventRegistrations = async (
    eventId: string,
    status?: RegistrationStatus,
) => {
    const where: any = { eventId };
    if (status) {
        where.status = status;
    }

    return await prisma.eventRegistration.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
        },
        orderBy: [
            { status: "asc" }, // REGISTERED first, then WAITLISTED
            { createdAt: "asc" },
        ],
    });
};

export const getEventWaitlist = async (eventId: string) => {
    return await prisma.eventRegistration.findMany({
        where: {
            eventId,
            status: "WAITLISTED",
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });
};

export const moveFromWaitlistToRegistered = async (
    eventId: string,
    userId: string,
) => {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            _count: {
                select: {
                    registrations: {
                        where: { status: "REGISTERED" },
                    },
                },
            },
        },
    });

    if (!event) {
        throw new Error("Event not found");
    }

    // Check if there's capacity
    if (
        event.maxParticipants &&
        event._count.registrations >= event.maxParticipants
    ) {
        throw new Error("Event is at capacity");
    }

    const registration = await prisma.eventRegistration.findUnique({
        where: {
            eventId_userId: {
                eventId,
                userId,
            },
        },
    });

    if (!registration) {
        throw new Error("Registration not found");
    }

    if (registration.status !== "WAITLISTED") {
        throw new Error("User is not on the waitlist");
    }

    return await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { status: "REGISTERED" },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                },
            },
        },
    });
};
