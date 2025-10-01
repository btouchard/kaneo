import { eq, isNull, sql } from "drizzle-orm";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";

/**
 * Migration script to handle conversion from user_email to user_id in workspace_member table.
 * This runs before Drizzle migrations to ensure no NULL user_id values exist.
 */
export async function migrateWorkspaceUserEmail() {
  console.log(
    "🔄 Checking workspace_member table for user_email to user_id migration...",
  );

  try {
    // Check if user_email column still exists
    const hasUserEmailColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workspace_member' 
      AND column_name = 'user_email'
    `);

    if (hasUserEmailColumn.rows.length > 0) {
      console.log("📧 Found user_email column, migrating to user_id...");

      // First, add user_id column if it doesn't exist
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'workspace_member' 
            AND column_name = 'user_id'
          ) THEN
            ALTER TABLE "workspace_member" ADD COLUMN "user_id" text;
          END IF;
        END $$;
      `);

      // Update user_id based on user_email
      await db.execute(sql`
        UPDATE "workspace_member" 
        SET "user_id" = (
          SELECT u.id 
          FROM "user" u 
          WHERE u.email = "workspace_member"."user_email"
        ) 
        WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
      `);

      // Remove records where user_email doesn't match any existing user
      const orphanedRecords = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM "workspace_member" 
        WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
      `);

      if (
        orphanedRecords.rows[0]?.count &&
        Number(orphanedRecords.rows[0].count) > 0
      ) {
        console.log(
          `⚠️  Found ${orphanedRecords.rows[0].count} workspace_member records with invalid user_email. Removing them...`,
        );

        await db.execute(sql`
          DELETE FROM "workspace_member" 
          WHERE "user_id" IS NULL AND "user_email" IS NOT NULL;
        `);
      }

      // Remove records where both user_email and user_id are NULL
      const nullRecords = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM "workspace_member" 
        WHERE "user_id" IS NULL AND ("user_email" IS NULL OR "user_email" = '');
      `);

      if (nullRecords.rows[0]?.count && Number(nullRecords.rows[0].count) > 0) {
        console.log(
          `⚠️  Found ${nullRecords.rows[0].count} workspace_member records with no user identification. Removing them...`,
        );

        await db.execute(sql`
          DELETE FROM "workspace_member" 
          WHERE "user_id" IS NULL AND ("user_email" IS NULL OR "user_email" = '');
        `);
      }

      console.log("✅ Successfully migrated user_email to user_id");
    }

    // Check if there are any remaining NULL user_id values
    const nullUserIds = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM "workspace_member" 
      WHERE "user_id" IS NULL;
    `);

    if (nullUserIds.rows[0]?.count && Number(nullUserIds.rows[0].count) > 0) {
      console.log(
        `⚠️  Found ${nullUserIds.rows[0].count} workspace_member records with NULL user_id. Removing them...`,
      );

      await db.execute(sql`
        DELETE FROM "workspace_member" 
        WHERE "user_id" IS NULL;
      `);

      console.log("✅ Removed records with NULL user_id");
    }

    console.log("✅ Workspace member migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during workspace member migration:", error);
    throw error;
  }
}
