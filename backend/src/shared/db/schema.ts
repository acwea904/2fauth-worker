import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 1. 金库项目表 (Vault Items -> mapped to 'vault' table in D1)
// 注意：唯一索引在 D1 上需手动创建，通过迁移命令运行一次即可。
// 该项目使用 SQLite schema 定义仅描述列，复杂索引/约束由数据库层管理。
export const vault = sqliteTable('vault', {
  id: text('id').primaryKey(), // UUID
  service: text('service').notNull(),
  account: text('account').notNull(),
  category: text('category'),
  secret: text('secret').notNull(), // 加密后的密文
  digits: integer('digits').default(6),
  period: integer('period').default(30),
  algorithm: text('algorithm').default('SHA-1'),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by'), // 'username' or 'restore'
  updatedAt: integer('updated_at'),
  updatedBy: text('updated_by'),
});

// 2. 备份提供商表 (Backup Providers)
export const backupProviders = sqliteTable('backup_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'webdav' | 's3'
  name: text('name').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  config: text('config').notNull(), // 加密后的 JSON 字符串
  autoBackup: integer('auto_backup', { mode: 'boolean' }).default(false),
  autoBackupPassword: text('auto_backup_password'), // 加密后的自动备份密码
  autoBackupRetain: integer('auto_backup_retain').default(30), // 保留备份数，0代表无限
  lastBackupAt: integer('last_backup_at'),
  lastBackupStatus: text('last_backup_status'), // 'success' | 'failed'
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// 导出类型定义
export type VaultItem = typeof vault.$inferSelect;
export type NewVaultItem = typeof vault.$inferInsert;
export type BackupProvider = typeof backupProviders.$inferSelect;
export type NewBackupProvider = typeof backupProviders.$inferInsert;