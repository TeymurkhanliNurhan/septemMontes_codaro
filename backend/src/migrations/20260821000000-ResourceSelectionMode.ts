import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResourceSelectionMode20260821000000 implements MigrationInterface {
  name = 'ResourceSelectionMode20260821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services ADD COLUMN IF NOT EXISTS resource_selection_mode
        varchar(50) NOT NULL DEFAULT 'AUTO';
    `);

    await queryRunner.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_service_resource_selection_mode;
    `);
    await queryRunner.query(`
      ALTER TABLE services ADD CONSTRAINT chk_service_resource_selection_mode
        CHECK (resource_selection_mode IN ('AUTO', 'CUSTOMER_CHOICE'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_service_resource_selection_mode;
    `);
    await queryRunner.query(`
      ALTER TABLE services DROP COLUMN IF EXISTS resource_selection_mode;
    `);
  }
}
