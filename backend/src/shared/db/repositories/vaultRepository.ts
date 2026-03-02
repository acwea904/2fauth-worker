import { eq, inArray, desc, like, or, and, sql } from 'drizzle-orm';
import { D1Database } from '@cloudflare/workers-types';
import { createDb } from '@/shared/db/db';
import { vault, type VaultItem, type NewVaultItem } from '@/shared/db/schema';

export class VaultRepository {
    private db;

    constructor(d1: D1Database) {
        this.db = createDb(d1);
    }

    /**
     * 获取所有的 vault items (2FA accounts)
     */
    async findAll(): Promise<VaultItem[]> {
        return await this.db
            .select()
            .from(vault)
            .orderBy(desc(vault.createdAt));
    }

    /**
     * 获取分页和搜索过滤的 vault items
     */
    async findPaginated(page: number, limit: number, search: string): Promise<VaultItem[]> {
        const offset = (page - 1) * limit;

        // 构建条件
        let condition;
        if (search) {
            const pattern = `%${search}%`;
            condition = or(
                like(vault.service, pattern),
                like(vault.account, pattern),
                like(vault.category, pattern)
            );
        }

        let query = this.db
            .select()
            .from(vault);

        if (condition) {
            query = query.where(condition) as any;
        }

        return await query
            .orderBy(desc(vault.createdAt))
            .limit(limit)
            .offset(offset);
    }

    /**
     * 获取满足条件的总记录数，用于分页计算
     */
    async count(search: string): Promise<number> {
        let condition;
        if (search) {
            const pattern = `%${search}%`;
            condition = or(
                like(vault.service, pattern),
                like(vault.account, pattern),
                like(vault.category, pattern)
            );
        }

        let query = this.db
            .select({ count: sql<number>`count(*)` })
            .from(vault);

        if (condition) {
            query = query.where(condition) as any;
        }

        const result = await query;
        return result[0]?.count || 0;
    }

    /**
     * 根据 ID 获取单个 item
     */
    async findById(id: string): Promise<VaultItem | undefined> {
        const result = await this.db
            .select()
            .from(vault)
            .where(eq(vault.id, id))
            .limit(1);

        return result[0];
    }

    /**
     * 根据 service/account 查找记录 (大小写不敏感，自动 trim)
     */
    async findByServiceAccount(service: string, account: string): Promise<VaultItem | undefined> {
        // 使用 lower() 函数进行数据库级别的大小写不敏感比较
        const normalizedService = service.trim().toLowerCase();
        const normalizedAccount = account.trim().toLowerCase();
        const result = await this.db
            .select()
            .from(vault)
            .where(
                sql`lower(${vault.service}) = ${normalizedService}`,
                sql`lower(${vault.account}) = ${normalizedAccount}`
            )
            .limit(1);
        return result[0];
    }

    /**
     * 创建一个新 item
     */
    async create(item: NewVaultItem): Promise<VaultItem> {
        const result = await this.db.insert(vault).values(item).returning();
        return result[0];
    }

    /**
     * 批量创建
     */
    async batchCreate(items: NewVaultItem[]): Promise<void> {
        if (!items || items.length === 0) return;

        // SQLite D1 limits variables, chunking is good practice
        const BATCH_SIZE = 50;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const chunk = items.slice(i, i + BATCH_SIZE);
            await this.db.insert(vault).values(chunk).run();
        }
    }

    /**
     * 更新一个 item
     */
    async update(id: string, data: Partial<NewVaultItem>): Promise<VaultItem | undefined> {
        const existing = await this.findById(id);
        if (!existing) return undefined;

        const result = await this.db
            .update(vault)
            .set({ ...data, updatedAt: Date.now() })
            .where(eq(vault.id, id))
            .returning();

        return result[0];
    }

    /**
     * 删除单个 item
     */
    async delete(id: string): Promise<boolean> {
        const existing = await this.findById(id);
        if (!existing) return false;

        await this.db.delete(vault).where(eq(vault.id, id)).run();
        return true;
    }

    /**
     * 批量删除
     */
    async batchDelete(ids: string[]): Promise<number> {
        if (!ids || ids.length === 0) return 0;

        let deletedCount = 0;
        const BATCH_SIZE = 50;
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const chunk = ids.slice(i, i + BATCH_SIZE);
            await this.db.delete(vault).where(inArray(vault.id, chunk)).run();
            deletedCount += chunk.length;
        }
        return deletedCount;
    }
}
