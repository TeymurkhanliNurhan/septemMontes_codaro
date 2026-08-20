import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResourceOrganizationCheck20260821120000 implements MigrationInterface {
  name = 'ResourceOrganizationCheck20260821120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resources_organization_match;
    `);
    await queryRunner.query(`
      ALTER TABLE resources ADD CONSTRAINT chk_resources_organization_match
        CHECK (organization_id = organizations_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resources_organization_match;
    `);
  }
}
