import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';

// Middleware to verify the Clerk session
// We can strictly use requireAuth() if we want to block unauthenticated requests
export const requireAuth = ClerkExpressWithAuth({
    // options if needed (e.g. onError)
});
