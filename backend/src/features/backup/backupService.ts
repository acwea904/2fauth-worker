import { eq, desc } from 'drizzle-orm';
import { EnvBindings, AppError } from '@/app/config';
import { BackupRepository } from '@/shared/db/repositories/backupRepository';
import { encryptData, decryptData, encryptBackupFile } from '@/shared/utils/crypto';
import { BackupProvider, WebDavProvider, S3Provider } from '@/features/backup/providers';
import { createDb, decryptField } from '@/shared/db/db';
import { vault as vaultTable, backupProviders } from '@/shared/db/schema';

export class BackupService {
    private repository: BackupRepository;
    private env: EnvBindings;
    private db: any;

    constructor(env: EnvBindings) {
        this.env = env;
        this.db = createDb(env.DB);
        this.repository = new BackupRepository(env.DB);
    }

    private async getProvider(type: string, config: any): Promise<BackupProvider> {
        switch (type) {
            case 'webdav':
                return new WebDavProvider(config);
            case 's3':
                return new S3Provider(config);
            default:
                throw new AppError('provider_not_found', 400);
        }
    }

    private async processConfigForStorage(type: string, config: any, key: string) {
        const processed = { ...config };
        if (type === 'webdav' && processed.password) {
            processed.password = await encryptData(processed.password, key);
        }
        if (type === 's3' && processed.secretAccessKey) {
            processed.secretAccessKey = await encryptData(processed.secretAccessKey, key);
        }
        return JSON.stringify(processed);
    }

    public async processConfigForUsage(type: string, configStr: string, key: string) {
        const config = JSON.parse(configStr);
        if (type === 'webdav' && config.password) {
            config.password = await decryptData(config.password, key);
        }
        if (type === 's3' && config.secretAccessKey) {
            config.secretAccessKey = await decryptData(config.secretAccessKey, key);
        }
        return config;
    }

    async getProvidersList() {
        const results = await this.repository.findAllSettings();
        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
        const MASK = '******';

        return await Promise.all(results.map(async (row: any) => {
            const config = await this.processConfigForUsage(row.type, row.config, key);

            if (row.type === 'webdav' && config.password) {
                config.password = MASK;
            }
            if (row.type === 's3' && config.secretAccessKey) {
                config.secretAccessKey = MASK;
            }

            return {
                ...row,
                config,
                auto_backup: !!row.autoBackup,
                auto_backup_password: !!row.autoBackupPassword,
                auto_backup_retain: row.autoBackupRetain !== null ? row.autoBackupRetain : 30
            };
        }));
    }

    async addProvider(data: any): Promise<number> {
        const { type, name, config, autoBackup, autoBackupPassword, autoBackupRetain } = data;
        if (!type || !name || !config) throw new AppError('missing_fields', 400);

        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
        const encryptedConfig = await this.processConfigForStorage(type, config, key);

        let encryptedAutoBackupPwd = null;
        if (autoBackup && autoBackupPassword) {
            if (autoBackupPassword.length < 12) throw new AppError('backup_password_length', 400);
            encryptedAutoBackupPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
        } else if (autoBackup) {
            throw new AppError('backup_password_required', 400);
        }

        const res = await this.db.insert(backupProviders).values({
            type,
            name,
            config: encryptedConfig,
            autoBackup: autoBackup ? true : false,
            autoBackupPassword: encryptedAutoBackupPwd,
            autoBackupRetain: autoBackupRetain !== undefined ? parseInt(autoBackupRetain, 10) : 30,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).returning({ id: backupProviders.id });

        return res[0].id;
    }

    async updateProvider(id: number, data: any) {
        const { name, config, type, autoBackup, autoBackupPassword, autoBackupRetain } = data;
        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
        const MASK = '******';

        const currentProvider = await this.db.select().from(backupProviders).where(eq(backupProviders.id, id)).get();
        if (currentProvider) {
            const currentConfigBase = await this.processConfigForUsage(currentProvider.type, currentProvider.config, key);
            if (type === 'webdav' && (config.password === MASK || !config.password)) {
                config.password = currentConfigBase.password;
            }
            if (type === 's3' && (config.secretAccessKey === MASK || !config.secretAccessKey)) {
                config.secretAccessKey = currentConfigBase.secretAccessKey;
            }
        }

        const encryptedConfig = await this.processConfigForStorage(type, config, key);

        const current = await this.db.select({ autoBackupPassword: backupProviders.autoBackupPassword }).from(backupProviders).where(eq(backupProviders.id, id)).get();

        let finalAutoPwd = current?.autoBackupPassword;
        if (autoBackupPassword) {
            if (autoBackupPassword.length < 12) throw new AppError('backup_password_length', 400);
            finalAutoPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
        } else if (autoBackup && !finalAutoPwd) {
            throw new AppError('backup_password_required', 400);
        }

        await this.db.update(backupProviders).set({
            name,
            config: encryptedConfig,
            autoBackup: autoBackup ? true : false,
            autoBackupPassword: finalAutoPwd,
            autoBackupRetain: autoBackupRetain !== undefined ? parseInt(autoBackupRetain, 10) : 30,
            updatedAt: Date.now()
        }).where(eq(backupProviders.id, id)).run();
    }

    async deleteProvider(id: number) {
        await this.db.delete(backupProviders).where(eq(backupProviders.id, id)).run();
    }

    async testConnection(type: string, config: any, id?: number) {
        const MASK = '******';
        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;

        if (id) {
            const currentProvider = await this.db.select().from(backupProviders).where(eq(backupProviders.id, id)).get();
            if (currentProvider) {
                const currentConfigBase = await this.processConfigForUsage(currentProvider.type, currentProvider.config, key);
                if (type === 'webdav' && config.password === MASK) {
                    config.password = currentConfigBase.password;
                }
                if (type === 's3' && config.secretAccessKey === MASK) {
                    config.secretAccessKey = currentConfigBase.secretAccessKey;
                }
            }
        }

        try {
            const provider = await this.getProvider(type, config);
            await provider.testConnection();
        } catch (e: any) {
            throw new AppError(`connection_failed: ${e.message}`, 400);
        }
    }

    async executeManualBackup(id: number, data: any) {
        const { filename, content, password } = data;
        let finalFilename: string;
        let finalContent: string;
        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;

        if (filename && content) {
            finalFilename = filename;
            finalContent = content;
        } else if (password !== undefined) {
            let backupPassword = password;
            const providerRow = await this.db.select({ autoBackupPassword: backupProviders.autoBackupPassword }).from(backupProviders).where(eq(backupProviders.id, id)).get();

            if (password === '') {
                if (!providerRow || !providerRow.autoBackupPassword) {
                    throw new AppError('manual_backup_password_needed', 400);
                }
                backupPassword = await decryptData(JSON.parse(providerRow.autoBackupPassword), key);
            }

            if (!backupPassword || backupPassword.length < 12) {
                throw new AppError('backup_password_length', 400);
            }

            const vaultResults = await this.db.select().from(vaultTable).all();
            const accounts = (await Promise.all(vaultResults.map(async (row: any) => {
                const secret = await decryptField(row.secret, key);
                if (!secret) return null;
                return {
                    service: row.service,
                    account: row.account,
                    category: row.category,
                    secret: secret,
                    digits: row.digits,
                    period: row.period
                };
            }))).filter(Boolean);

            const exportPayload = {
                version: "2.0",
                app: "2fauth",
                encrypted: true,
                timestamp: new Date().toISOString(),
                accounts
            };

            const userEncrypted = await encryptBackupFile(exportPayload, backupPassword);
            const fileContent = JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: undefined });

            finalFilename = `2fa-backup-manual-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            finalContent = fileContent;
        } else {
            throw new AppError('missing_fields', 400);
        }

        const providerRow = await this.db.select().from(backupProviders).where(eq(backupProviders.id, id)).get();
        if (!providerRow) throw new AppError('provider_not_found', 404);

        const configObj = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
        const provider = await this.getProvider(providerRow.type, configObj);

        try {
            await provider.uploadBackup(finalFilename, finalContent);
            await this.db.update(backupProviders).set({
                lastBackupAt: Date.now(),
                lastBackupStatus: 'success'
            }).where(eq(backupProviders.id, id)).run();
        } catch (e: any) {
            await this.db.update(backupProviders).set({ lastBackupStatus: 'failed' }).where(eq(backupProviders.id, id)).run();
            throw new AppError(`backup_failed: ${e.message}`, 500);
        }
    }

    async getFiles(id: number) {
        const providerRow = await this.db.select().from(backupProviders).where(eq(backupProviders.id, id)).get();
        if (!providerRow) throw new AppError('provider_not_found', 404);

        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
        const config = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
        const provider = await this.getProvider(providerRow.type, config);

        return await provider.listBackups();
    }

    async downloadFile(id: number, filename: string) {
        if (!filename) throw new AppError('filename_required', 400);

        const providerRow = await this.db.select().from(backupProviders).where(eq(backupProviders.id, id)).get();
        if (!providerRow) throw new AppError('provider_not_found', 404);

        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
        const config = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
        const provider = await this.getProvider(providerRow.type, config);

        try {
            return await provider.downloadBackup(filename);
        } catch (e: any) {
            throw new AppError(`download_failed: ${e.message}`, 500);
        }
    }

    async handleScheduledBackup() {
        console.log('[Backup] Starting scheduled backup...');
        const providers = await this.db.select().from(backupProviders).all();
        if (!providers || providers.length === 0) {
            console.log('[Backup] No backup providers configured.');
            return;
        }

        const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;

        const vaultResults = await this.db.select().from(vaultTable).all();
        const accounts = (await Promise.all(vaultResults.map(async (row: any) => {
            const secret = await decryptField(row.secret, key);
            if (!secret) return null;
            return {
                service: row.service,
                account: row.account,
                category: row.category,
                secret: secret,
                digits: row.digits,
                period: row.period
            };
        }))).filter(Boolean);

        const exportPayload = {
            version: "2.0",
            app: "2fauth",
            encrypted: true,
            timestamp: new Date().toISOString(),
            accounts
        };

        const filename = `2fa-backup-auto-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        for (const row of providers) {
            if (!row.autoBackup || !row.autoBackupPassword) continue;

            try {
                const backupPassword = await decryptData(JSON.parse(row.autoBackupPassword), key);
                const userEncrypted = await encryptBackupFile(exportPayload, backupPassword);
                const fileContent = JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: undefined });

                const config = await this.processConfigForUsage(row.type as string, row.config as string, key);
                const provider = await this.getProvider(row.type as string, config);

                await provider.uploadBackup(filename, fileContent);

                await this.db.update(backupProviders).set({
                    lastBackupAt: Date.now(),
                    lastBackupStatus: 'success'
                }).where(eq(backupProviders.id, row.id)).run();

                console.log(`[Backup] Successfully backed up to ${row.name}`);

                const retainCount = row.autoBackupRetain !== null ? row.autoBackupRetain : 30;
                if (retainCount > 0) {
                    try {
                        const files = await provider.listBackups();
                        const autoFiles = files.filter((f: any) => f.filename.startsWith('2fa-backup-auto-'))
                            .sort((a: any, b: any) => b.filename.localeCompare(a.filename));

                        if (autoFiles.length > retainCount) {
                            const filesToDelete = autoFiles.slice(retainCount);
                            for (const fileToDelete of filesToDelete) {
                                try {
                                    await provider.deleteBackup(fileToDelete.filename);
                                    console.log(`[Backup Prune] Deleted old auto-backup: ${fileToDelete.filename}`);
                                } catch (delErr: any) {
                                    console.error(`[Backup Prune] Failed to delete ${fileToDelete.filename}: ${delErr.message}`);
                                }
                            }
                        }
                    } catch (listErr: any) {
                        console.error(`[Backup Prune] Failed to list backups for pruning: ${listErr.message}`);
                    }
                }
            } catch (e: any) {
                console.error(`[Backup] Failed to backup to ${row.name}: ${e.message}`);
                await this.db.update(backupProviders).set({ lastBackupStatus: 'failed' }).where(eq(backupProviders.id, row.id)).run();
            }
        }
    }
}
