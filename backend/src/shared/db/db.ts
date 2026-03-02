import { drizzle } from 'drizzle-orm/d1';
import { inArray } from 'drizzle-orm';
import { D1Database } from '@cloudflare/workers-types';
import * as schema from '@/shared/db/schema';
import { encryptData, decryptData } from '@/shared/utils/crypto';
import { sanitizeInput } from '@/shared/utils/common';

// 创建 Drizzle 实例的工厂函数
export const createDb = (d1: D1Database) => drizzle(d1, { schema });

// 加密并序列化字段
export async function encryptField(data: any, key: string) {
    const encrypted = await encryptData(data, key);
    return JSON.stringify(encrypted);
}

// 反序列化并解密字段
export async function decryptField(encryptedStr: string, key: string) {
    try {
        const encryptedObj = JSON.parse(encryptedStr);
        return await decryptData(encryptedObj, key);
    } catch (e) {
        console.error('Decryption failed', e);
        return null;
    }
}

/**
 * 批量插入金库项目 (数据清洗 + 并行加密 + 分批写入)
 * @param db D1 数据库实例
 * @param items 待插入的原始项目列表
 * @param key 加密密钥
 * @param createdBy 创建者标识 (username 或 'restore')
 * @returns 成功插入的数量
 */
export async function batchInsertVaultItems(
    db: D1Database,
    items: any[],
    key: string,
    createdBy: string
): Promise<number> {
    const dbClient = createDb(db);

    // 1. 准备数据 (规范化、加密、生成ID)
    const preparedItems = await Promise.all(items.map(async (item) => {
        // 规范化密钥 (去除空格，转大写)
        const normalizedSecret = (item.secret || '').replace(/\s/g, '').toUpperCase();
        const secretEncrypted = await encryptField(normalizedSecret, key);

        return {
            id: crypto.randomUUID(),
            service: sanitizeInput(item.service, 50),
            account: sanitizeInput(item.account, 100),
            category: item.category ? sanitizeInput(item.category, 30) : '',
            secret: secretEncrypted,          // Drizzle schema 字段名
            algorithm: item.algorithm || 'SHA1',
            digits: item.digits || 6,
            period: item.period || 30,
            createdAt: Date.now(),            // camelCase 匹配 Drizzle schema
            createdBy: createdBy,             // camelCase 匹配 Drizzle schema
        };
    }));

    // 2. 批量写入：使用 D1 的 batch 功能避免连接超时。
    // 分批写入，每批最多 50 条。
    const CHUNK_SIZE = 50;
    for (let i = 0; i < preparedItems.length; i += CHUNK_SIZE) {
        const chunk = preparedItems.slice(i, i + CHUNK_SIZE);
        const stmts = chunk.map(item => dbClient.insert(schema.vault).values(item));
        await dbClient.batch(stmts as any);
    }


    return preparedItems.length;
}

/**
 * 批量删除金库项目 (分批 + 并行)
 * @param db D1 数据库实例
 * @param ids 待删除的项目 ID 列表
 * @returns 成功删除的数量
 */
export async function batchDeleteVaultItems(
    db: D1Database,
    ids: string[]
): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const dbClient = createDb(db);

    // Drizzle 的 inArray 操作非常简洁
    const CHUNK_SIZE = 50;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        await dbClient.delete(schema.vault).where(inArray(schema.vault.id, chunk)).run();
    }

    return ids.length; // D1 delete 返回结果不包含 count，这里近似返回
}