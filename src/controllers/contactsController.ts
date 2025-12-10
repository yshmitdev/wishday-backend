import { Request, Response } from 'express';
import { db } from '../db';
import { users, contactsBirthdays } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Zod schemas for validation
const createContactSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    birthdayMonth: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    birthdayDay: z.number().int().min(1, 'Day must be between 1 and 31').max(31, 'Day must be between 1 and 31'),
    birthdayYear: z.number().int().nullable().optional(),
});

const updateContactSchema = z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    birthdayMonth: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12').optional(),
    birthdayDay: z.number().int().min(1, 'Day must be between 1 and 31').max(31, 'Day must be between 1 and 31').optional(),
    birthdayYear: z.number().int().nullable().optional(),
}).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
);

// Helper function to format Zod errors
const formatZodError = (error: z.ZodError<unknown>) => {
    return error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));
};

// Helper function to authenticate and get user record
// Returns the user record if successful, or null if an error response was sent
const getAuthenticatedUser = async (req: Request, res: Response) => {
    const clerkUserId = (req as any).auth?.userId;

    if (!clerkUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    const userRecord = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

    if (userRecord.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return null;
    }

    return userRecord[0];
};

// GET /api/contacts - Get all contacts for the authenticated user
export const getContacts = async (req: Request, res: Response) => {
    try {
        const userRecord = await getAuthenticatedUser(req, res);
        if (!userRecord) return;

        const contacts = await db.select().from(contactsBirthdays).where(eq(contactsBirthdays.userId, userRecord.id));
        res.json(contacts);
    } catch (err) {
        console.error('Error fetching contacts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /api/contacts/:id - Get a single contact by ID
export const getContactById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const userRecord = await getAuthenticatedUser(req, res);
        if (!userRecord) return;

        const contact = await db.select().from(contactsBirthdays).where(
            and(
                eq(contactsBirthdays.id, id),
                eq(contactsBirthdays.userId, userRecord.id)
            )
        ).limit(1);

        if (contact.length === 0) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        res.json(contact[0]);
    } catch (err) {
        console.error('Error fetching contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /api/contacts - Create a new contact
export const createContact = async (req: Request, res: Response) => {
    const validation = createContactSchema.safeParse(req.body);

    if (!validation.success) {
        res.status(400).json({ errors: formatZodError(validation.error) });
        return;
    }

    const { name, birthdayYear, birthdayMonth, birthdayDay } = validation.data;

    try {
        const userRecord = await getAuthenticatedUser(req, res);
        if (!userRecord) return;

        const newContact = await db.insert(contactsBirthdays).values({
            userId: userRecord.id,
            name,
            birthdayYear: birthdayYear ?? null,
            birthdayMonth,
            birthdayDay,
        }).returning();

        res.status(201).json(newContact[0]);
    } catch (err) {
        console.error('Error creating contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// PUT /api/contacts/:id - Update a contact
export const updateContact = async (req: Request, res: Response) => {
    const { id } = req.params;

    const validation = updateContactSchema.safeParse(req.body);

    if (!validation.success) {
        res.status(400).json({ errors: formatZodError(validation.error) });
        return;
    }

    const { name, birthdayYear, birthdayMonth, birthdayDay } = validation.data;

    try {
        const userRecord = await getAuthenticatedUser(req, res);
        if (!userRecord) return;

        // Check if contact exists and belongs to user
        const existingContact = await db.select().from(contactsBirthdays).where(
            and(
                eq(contactsBirthdays.id, id),
                eq(contactsBirthdays.userId, userRecord.id)
            )
        ).limit(1);

        if (existingContact.length === 0) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        // Build update object with only provided fields
        const updateData: Partial<{
            name: string;
            birthdayYear: number | null;
            birthdayMonth: number;
            birthdayDay: number;
            updatedAt: Date;
        }> = {
            updatedAt: new Date(),
        };

        if (name !== undefined) updateData.name = name;
        if (birthdayYear !== undefined) updateData.birthdayYear = birthdayYear;
        if (birthdayMonth !== undefined) updateData.birthdayMonth = birthdayMonth;
        if (birthdayDay !== undefined) updateData.birthdayDay = birthdayDay;

        const updatedContact = await db.update(contactsBirthdays)
            .set(updateData)
            .where(
                and(
                    eq(contactsBirthdays.id, id),
                    eq(contactsBirthdays.userId, userRecord.id)
                )
            )
            .returning();

        res.json(updatedContact[0]);
    } catch (err) {
        console.error('Error updating contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// DELETE /api/contacts/:id - Delete a contact
export const deleteContact = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const userRecord = await getAuthenticatedUser(req, res);
        if (!userRecord) return;

        // Check if contact exists and belongs to user
        const existingContact = await db.select().from(contactsBirthdays).where(
            and(
                eq(contactsBirthdays.id, id),
                eq(contactsBirthdays.userId, userRecord.id)
            )
        ).limit(1);

        if (existingContact.length === 0) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        await db.delete(contactsBirthdays).where(
            and(
                eq(contactsBirthdays.id, id),
                eq(contactsBirthdays.userId, userRecord.id)
            )
        );

        res.status(204).send();
    } catch (err) {
        console.error('Error deleting contact:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
