import { serve } from '@hono/node-server';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import cron from 'node-cron';
import app from '@/app/index.js';
import * as schema from '@/shared/db/schema.js';
import { handleScheduledBackup } from '@/features/backup/backupRoutes.js';
import fs from 'fs';
import path from 'path';

// 1. Resolve paths
// In Docker, we run from /app, and frontend is at /app/frontend/dist
// The server.js is at /app/backend/dist/server.js
const baseDir = process.cwd(); // Should be /app in Docker
const frontendDistPath = path.resolve(baseDir, 'frontend/dist');
const dataDir = path.resolve(baseDir, 'data');

console.log(`[Docker Server] Base directory: ${baseDir}`);
console.log(`[Docker Server] Frontend dist path: ${frontendDistPath}`);

// 2. Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 3. Initialize local SQLite Database
const dbFile = process.env.SQLITE_DB_PATH || path.join(dataDir, '2fauth.db');
const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');

// 4. Initialize Drizzle ORM
const db = drizzle(sqlite, { schema });

// 5. Run migrations/schema creation if needed
const checkTable = sqlite.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='vault'").get() as any;
if (checkTable['count(*)'] === 0) {
    console.log('Initializing database schema...');
    // In Docker, schema.sql is copied to the root /app/
    const schemaFile = fs.existsSync(path.join(baseDir, 'schema.sql'))
        ? path.join(baseDir, 'schema.sql')
        : path.join(baseDir, 'backend/schema.sql'); // fallback for local dev
    const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
    sqlite.exec(schemaSql);
    console.log('Database initialized.');
}

// 6. Setup environment for Hono
const envTemplate = {
    DB: db,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    OAUTH_ALLOWED_USERS: process.env.OAUTH_ALLOWED_USERS || '',
    ...process.env
};

// 7. Define the ASSETS.fetch logic for Node.js
// This replaces Cloudflare's ASSETS.fetch
const nodeAssetsFetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    let filePath = path.join(frontendDistPath, url.pathname);

    // Security: check that the file is actually inside frontendDistPath
    if (!filePath.startsWith(frontendDistPath)) {
        return new Response('Forbidden', { status: 403 });
    }

    // SPA fallback: if it's a directory or file doesn't exist, serve index.html
    if (url.pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(frontendDistPath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
    }

    const content = fs.readFileSync(filePath);

    // Mime types
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webmanifest': 'application/manifest+json',
        '.wasm': 'application/wasm'
    };

    return new Response(content, {
        headers: {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};

// 8. Cron Triggers
cron.schedule('0 2 * * *', async () => {
    try {
        console.log('[Cron] Triggering daily backup...');
        await handleScheduledBackup(envTemplate as any);
    } catch (e) {
        console.error('[Cron] Backup failed:', e);
    }
});

// 9. Start Server
const port = parseInt(process.env.PORT || '3000', 10);
serve({
    fetch: (req) => {
        const env = {
            ...envTemplate,
            ASSETS: { fetch: nodeAssetsFetch }
        };
        return app.fetch(req, env as any, {
            waitUntil: (p: Promise<any>) => p.catch(console.error)
        } as any);
    },
    port
}, (info) => {
    console.log(`[Docker Server] 2FAuth is running on http://localhost:${info.port}`);
});
