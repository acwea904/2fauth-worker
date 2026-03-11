import { drizzle } from 'drizzle-orm/d1';
import app from '@/app/index.js';
import * as schema from '@/shared/db/schema.js';
import { handleScheduledBackup } from '@/features/backup/backupRoutes.js';

export default {
    async fetch(request: Request, env: any, ctx: any) {
        // Initialize D1 driver
        const db = drizzle(env.DB, { schema });

        // Pass specialized DB and env vars to agnostic router
        const specializedEnv = {
            ...env,
            DB: db, // Replace D1 with Drizzle ORM instance
            ASSETS: env.ASSETS // Ensure ASSETS exists
        };

        return app.fetch(request, specializedEnv, ctx);
    },

    // Scheduled Backup trigger via Cloudflare Cron
    async scheduled(event: any, env: any, ctx: any) {
        console.log(`[Cron] Scheduled event triggered at ${new Date().toISOString()}`);
        const db = drizzle(env.DB, { schema });
        const specializedEnv = {
            ...env,
            DB: db
        };
        ctx.waitUntil(handleScheduledBackup(specializedEnv));
    }
};
