import { Router } from 'express';
import { 
    getContacts, 
    getContactById, 
    createContact, 
    updateContact, 
    deleteContact 
} from '../controllers/contactsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.get('/', requireAuth as any, getContacts);           // GET /api/contacts - List all contacts
router.get('/:id', requireAuth as any, getContactById);     // GET /api/contacts/:id - Get single contact
router.post('/', requireAuth as any, createContact);        // POST /api/contacts - Create contact
router.put('/:id', requireAuth as any, updateContact);      // PUT /api/contacts/:id - Update contact
router.delete('/:id', requireAuth as any, deleteContact);   // DELETE /api/contacts/:id - Delete contact

export default router;
