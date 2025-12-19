import { Request, Response } from 'express';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { db } from '../db';
import { users, contactsBirthdays } from '../db/schema';
import { eq } from 'drizzle-orm';

// =============================================================================
// Configuration
// =============================================================================

const MODEL = 'openai/gpt-oss-120b';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const SYSTEM_PROMPT = `You are Wishday Assistant, a friendly AI for managing birthdays and celebrations.

CAPABILITIES:
- Look up user's contacts and birthdays using the getContacts tool
- Suggest gift ideas based on contact notes/preferences
- Help with celebration planning tips

INSTRUCTIONS:
- Use getContacts when users ask about birthdays, contacts, or specific people
- After using a tool, respond naturally with the results
- Be warm and concise, use occasional emojis 🎂
- Keep responses SHORT (max 2-3 sentences for simple questions, max 5-6 for complex ones)
- For lists, show max 5 items unless user asks for more
- Avoid long explanations or verbose formatting

Today's date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

const groq = createOpenAICompatible({
    name: 'groq',
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

// =============================================================================
// Helper Functions
// =============================================================================

async function getUserId(clerkUserId: string): Promise<string | null> {
    const userRecord = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

    return userRecord.length > 0 ? userRecord[0].id : null;
}

function formatContact(contact: typeof contactsBirthdays.$inferSelect): string {
    const birthday = `${MONTH_NAMES[contact.birthdayMonth - 1]} ${contact.birthdayDay}${contact.birthdayYear ? `, ${contact.birthdayYear}` : ''}`;
    const notes = contact.notes ? ` | Notes: ${contact.notes}` : '';
    return `- ${contact.name}: ${birthday}${notes}`;
}

// =============================================================================
// Tools
// =============================================================================

function createTools(userId: string | null) {
    return {
        getContacts: tool({
            description: 'Get all contacts and their birthdays. Use when user asks about birthdays, contacts, upcoming celebrations, or specific people.',
            inputSchema: z.object({}),
            execute: async () => {
                if (!userId) {
                    return 'User not found. Please ensure you are logged in.';
                }

                const contacts = await db
                    .select()
                    .from(contactsBirthdays)
                    .where(eq(contactsBirthdays.userId, userId));

                if (contacts.length === 0) {
                    return 'No contacts found. The user hasn\'t added any birthdays yet.';
                }

                const contactList = contacts.map(formatContact).join('\n');
                return `${contacts.length} contact(s):\n${contactList}`;
            },
        }),
    };
}

// =============================================================================
// Controller
// =============================================================================

export async function chatWithAssistant(req: Request, res: Response) {
    try {
        const { messages } = req.body;
        const clerkUserId = (req as any).auth?.userId;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        if (!clerkUserId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = await getUserId(clerkUserId);
        const modelMessages = convertToModelMessages(messages);

        const result = streamText({
            model: groq(MODEL),
            system: SYSTEM_PROMPT,
            messages: modelMessages,
            stopWhen: stepCountIs(3),
            tools: createTools(userId),
        });

        result.pipeUIMessageStreamToResponse(res);
    } catch (error) {
        console.error('Assistant error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
