-- 账号表：存储 2FA 凭据
CREATE TABLE IF NOT EXISTS vault (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    account TEXT NOT NULL,
    category TEXT,
    secret TEXT NOT NULL,          -- 加密存储 {encrypted, iv, salt}
    digits INTEGER DEFAULT 6,
    period INTEGER DEFAULT 30,
    algorithm TEXT DEFAULT 'SHA1',
    created_at INTEGER,
    created_by TEXT,
    updated_at INTEGER,
    updated_by TEXT
);

-- 云端备份源配置表
CREATE TABLE IF NOT EXISTS backup_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,            -- 类型: 'webdav', 's3'
    name TEXT NOT NULL,            -- 显示名称
    is_enabled BOOLEAN DEFAULT 1,  -- 启用状态
    config TEXT NOT NULL,          -- 配置 JSON (敏感字段加密)
    auto_backup BOOLEAN DEFAULT 0, -- 自动备份开关
    auto_backup_password TEXT,     -- 自动备份加密密码 (加密存储)
    auto_backup_retain INTEGER DEFAULT 30, -- 自动备份保留份数，0为无限
    last_backup_at INTEGER,        -- 最后备份时间戳
    last_backup_status TEXT,       -- 状态: 'success' | 'failed'
    created_at INTEGER,
    updated_at INTEGER
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_vault_service ON vault(service);
CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault(created_at DESC);

-- Remove any existing duplicates before enforcing unique constraint; keep the earliest
DELETE FROM vault
WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM vault
    GROUP BY lower(service), lower(account)
);

CREATE UNIQUE INDEX IF NOT EXISTS vault_service_account_uq ON vault(lower(service), lower(account));