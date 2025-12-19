import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { chatWithAssistant } from '../controllers/assistantController';

const router = Router();

// POST /api/assistant/chat - Send a message to the assistant
router.post('/chat', requireAuth as any, chatWithAssistant);

export default router;
