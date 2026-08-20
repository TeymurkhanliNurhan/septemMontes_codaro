import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSeptemMontesOrgAndNullableUserUpdatedAt20260820140000
  implements MigrationInterface
{
  name = 'SeedSeptemMontesOrgAndNullableUserUpdatedAt20260820140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN updated_at DROP NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO organizations (name, slug, timezone, metadata)
      SELECT 'Septem Montes', 'septem_montes', 'utc', '{}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM organizations WHERE slug = 'septem_montes'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM organizations WHERE slug = 'septem_montes'
    `);
    await queryRunner.query(`
      UPDATE users SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN updated_at SET NOT NULL
    `);
  }
}
