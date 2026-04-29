const { prisma } = require('../../config/db');

async function searchProfiles(q, limit = 20) {
    const query = q.trim();

    const [creators, freelancers] = await Promise.all([
        prisma.creatorProfile.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' },
                user: { status: 'ACTIVE' },
            },
            select: {
                id: true,
                userId: true,
                name: true,
                profilePicture: true,
                location: true,
                category: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
            take: limit,
        }),
        prisma.freelancerProfile.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' },
                user: { status: 'ACTIVE' },
            },
            select: {
                id: true,
                userId: true,
                name: true,
                profilePicture: true,
                location: true,
                category: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
            take: limit,
        }),
    ]);

    const results = [
        ...creators.map((p) => ({
            userId: p.userId,
            profileId: p.id,
            name: p.name,
            profilePicture: p.profilePicture || null,
            role: 'CREATOR',
            category: p.category?.name || null,
            categoryId: p.category?.id || null,
            location: p.location || null,
        })),
        ...freelancers.map((p) => ({
            userId: p.userId,
            profileId: p.id,
            name: p.name,
            profilePicture: p.profilePicture || null,
            role: 'FREELANCER',
            category: p.category?.name || null,
            categoryId: p.category?.id || null,
            location: p.location || null,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return results.slice(0, limit);
}

module.exports = { searchProfiles };
