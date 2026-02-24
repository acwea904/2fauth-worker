-- 账号表：每一行存储一个 2FA 凭据
-- 账号表：存储 2FA 凭据
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    account TEXT NOT NULL,
    category TEXT,
    secret TEXT NOT NULL,          -- 加密存储 {encrypted, iv, salt}
    digits INTEGER DEFAULT 6,
    period INTEGER DEFAULT 30,
    created_at INTEGER,
    created_by TEXT,
    updated_at INTEGER,
    updated_by TEXT
);

-- 备份源配置表
DROP TABLE IF EXISTS webdav_configs;
CREATE TABLE IF NOT EXISTS backup_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,            -- 类型: 'webdav', 's3'
    name TEXT NOT NULL,            -- 显示名称
    is_enabled BOOLEAN DEFAULT 1,  -- 启用状态
    config TEXT NOT NULL,          -- 配置 JSON (敏感字段加密)
    auto_backup BOOLEAN DEFAULT 0, -- 自动备份开关
    auto_backup_password TEXT,     -- 自动备份加密密码 (加密存储)
    last_backup_at INTEGER,        -- 最后备份时间戳
    last_backup_status TEXT,       -- 状态: 'success' | 'failed'
    created_at INTEGER,
    updated_at INTEGER
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_accounts_service ON accounts(service);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at DESC);