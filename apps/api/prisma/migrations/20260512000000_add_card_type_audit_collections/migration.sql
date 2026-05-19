-- ============================================================
-- Idempotent migration: add card_type, audit_logs, audit_config, collections
-- All statements safe to re-run on both fresh and drifted databases.
-- ============================================================

-- 1. Add card_type column to cards (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND COLUMN_NAME = 'card_type') = 0,
  'ALTER TABLE `cards` ADD COLUMN `card_type` ENUM(''character'', ''worldbook'', ''preset'') NOT NULL DEFAULT ''character''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Index on card_type (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND INDEX_NAME = 'cards_card_type_idx') = 0,
  'CREATE INDEX `cards_card_type_idx` ON `cards`(`card_type`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Extend PaymentProvider enum with 'epay' (idempotent — MySQL accepts same enum definition)
ALTER TABLE `payment_events` MODIFY COLUMN `provider` ENUM('stripe', 'yipay', 'epay') NOT NULL;

-- 4. Create audit_logs table (native IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `detail` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create audit_config table (native IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS `audit_config` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `audit_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Create collections table (native IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS `collections` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `character_card_id` VARCHAR(191) NOT NULL,
    `worldbook_card_id` VARCHAR(191) NOT NULL,
    `preset_card_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `collections_author_id_idx`(`author_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. AddForeignKey: collections -> cards (character) — guarded
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections'
     AND CONSTRAINT_NAME = 'collections_character_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `collections` ADD CONSTRAINT `collections_character_card_id_fkey` FOREIGN KEY (`character_card_id`) REFERENCES `cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. AddForeignKey: collections -> cards (worldbook) — guarded
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections'
     AND CONSTRAINT_NAME = 'collections_worldbook_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `collections` ADD CONSTRAINT `collections_worldbook_card_id_fkey` FOREIGN KEY (`worldbook_card_id`) REFERENCES `cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. AddForeignKey: collections -> cards (preset) — guarded
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections'
     AND CONSTRAINT_NAME = 'collections_preset_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `collections` ADD CONSTRAINT `collections_preset_card_id_fkey` FOREIGN KEY (`preset_card_id`) REFERENCES `cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 10. AddForeignKey: collections -> users — guarded
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections'
     AND CONSTRAINT_NAME = 'collections_author_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `collections` ADD CONSTRAINT `collections_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 11. Drop stale cards_category_id_fkey (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards'
     AND CONSTRAINT_NAME = 'cards_category_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'ALTER TABLE `cards` DROP FOREIGN KEY `cards_category_id_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 12. Drop stale cards_category_id_idx (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND INDEX_NAME = 'cards_category_id_idx') > 0,
  'ALTER TABLE `cards` DROP INDEX `cards_category_id_idx`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 13. Drop category_id column (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND COLUMN_NAME = 'category_id') > 0,
  'ALTER TABLE `cards` DROP COLUMN `category_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 14. Drop categories table (native IF EXISTS)
DROP TABLE IF EXISTS `categories`;
