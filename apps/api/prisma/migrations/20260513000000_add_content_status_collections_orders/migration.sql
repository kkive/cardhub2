-- ============================================================
-- Idempotent migration: content status, collections extension,
-- orders/entitlements collection support, collection_exports
-- All statements safe to re-run on both fresh and drifted databases.
-- ============================================================

-- 1. Add status column to cards (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `cards` ADD COLUMN `status` ENUM(''draft'', ''published'') NOT NULL DEFAULT ''draft''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Index on cards.status (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cards' AND INDEX_NAME = 'cards_status_idx') = 0,
  'CREATE INDEX `cards_status_idx` ON `cards`(`status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Backfill existing public-visibility cards to published (idempotent)
UPDATE `cards` SET `status` = 'published' WHERE `visibility` = 'public' AND `status` = 'draft';

-- 4. Add summary to collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'summary') = 0,
  'ALTER TABLE `collections` ADD COLUMN `summary` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Add cover_url to collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'cover_url') = 0,
  'ALTER TABLE `collections` ADD COLUMN `cover_url` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Add status to collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE `collections` ADD COLUMN `status` ENUM(''draft'', ''published'') NOT NULL DEFAULT ''draft''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Add price to collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'price') = 0,
  'ALTER TABLE `collections` ADD COLUMN `price` INTEGER NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Add download_count to collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'download_count') = 0,
  'ALTER TABLE `collections` ADD COLUMN `download_count` INTEGER NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Index on collections.status (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND INDEX_NAME = 'collections_status_idx') = 0,
  'CREATE INDEX `collections_status_idx` ON `collections`(`status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 10. Drop orders_card_id_fkey before making card_id nullable (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
     AND CONSTRAINT_NAME = 'orders_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'ALTER TABLE `orders` DROP FOREIGN KEY `orders_card_id_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 11. Drop entitlements_card_id_fkey before making card_id nullable (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements'
     AND CONSTRAINT_NAME = 'entitlements_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
  'ALTER TABLE `entitlements` DROP FOREIGN KEY `entitlements_card_id_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 12. Add target_type to orders (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'target_type') = 0,
  'ALTER TABLE `orders` ADD COLUMN `target_type` ENUM(''card'', ''collection'') NOT NULL DEFAULT ''card''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 13. Add collection_id to orders (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'collection_id') = 0,
  'ALTER TABLE `orders` ADD COLUMN `collection_id` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 14. Make orders.card_id nullable (idempotent — safe to re-run)
ALTER TABLE `orders` MODIFY COLUMN `card_id` VARCHAR(191) NULL;

-- 15. Index on orders.collection_id (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'orders_collection_id_idx') = 0,
  'CREATE INDEX `orders_collection_id_idx` ON `orders`(`collection_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 16. Re-add orders -> cards FK (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
     AND CONSTRAINT_NAME = 'orders_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `orders` ADD CONSTRAINT `orders_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 17. AddForeignKey: orders -> collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
     AND CONSTRAINT_NAME = 'orders_collection_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `orders` ADD CONSTRAINT `orders_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 18. Add collection_id to entitlements (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements' AND COLUMN_NAME = 'collection_id') = 0,
  'ALTER TABLE `entitlements` ADD COLUMN `collection_id` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 19. Make entitlements.card_id nullable (idempotent — safe to re-run)
ALTER TABLE `entitlements` MODIFY COLUMN `card_id` VARCHAR(191) NULL;

-- 20. Unique index on entitlements(user_id, collection_id) (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements' AND INDEX_NAME = 'entitlements_user_id_collection_id_key') = 0,
  'CREATE UNIQUE INDEX `entitlements_user_id_collection_id_key` ON `entitlements`(`user_id`, `collection_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 21. Index on entitlements.collection_id (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements' AND INDEX_NAME = 'entitlements_collection_id_idx') = 0,
  'CREATE INDEX `entitlements_collection_id_idx` ON `entitlements`(`collection_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 22. Re-add entitlements -> cards FK (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements'
     AND CONSTRAINT_NAME = 'entitlements_card_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 23. AddForeignKey: entitlements -> collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entitlements'
     AND CONSTRAINT_NAME = 'entitlements_collection_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 24. Create collection_exports table (native IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS `collection_exports` (
    `id` VARCHAR(191) NOT NULL,
    `collection_id` VARCHAR(191) NOT NULL,
    `format` ENUM('platform_json', 'sillytavern_v2', 'tavernai') NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `collection_exports_collection_id_idx`(`collection_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 25. AddForeignKey: collection_exports -> collections (guarded)
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collection_exports'
     AND CONSTRAINT_NAME = 'collection_exports_collection_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `collection_exports` ADD CONSTRAINT `collection_exports_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
