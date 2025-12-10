import { Router } from 'express';
import { syncUser } from '../controllers/usersController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply auth middleware to sync endpoint
router.post('/sync', requireAuth as any, syncUser);

export default router;
