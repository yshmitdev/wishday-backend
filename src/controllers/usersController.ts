import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { clerkClient } from '@clerk/clerk-sdk-node';

export const syncUser = async (req: Request, res: Response) => {
    const authUserId = (req as any).auth?.userId;

    if (!authUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const user = await clerkClient.users.getUser(authUserId);
        const email = user.emailAddresses[0]?.emailAddress;

        await db.insert(users)
            .values({
                clerkUserId: authUserId,
                email
            })
            .onConflictDoUpdate({
                target: users.clerkUserId,
                set: {
                    email,
                    updatedAt: new Date()
                }
            });

        console.log(`User synced: ${authUserId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error sync user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
