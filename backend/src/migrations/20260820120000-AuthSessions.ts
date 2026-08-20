import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSessions20260820120000 implements MigrationInterface {
  name = 'AuthSessions20260820120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar(255);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        user_agent varchar(512),
        ip varchar(64),
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        absolute_expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        CONSTRAINT sessions_pk PRIMARY KEY (id),
        CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
    `);

    await queryRunner.query(`
      ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_user;
    `);
    await queryRunner.query(`
      ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sessions CASCADE;`);
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS password_hash;`,
    );
  }
}
