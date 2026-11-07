"""Vincula contas de paciente e revoga JWTs no logout."""

from alembic import op
import sqlalchemy as sa


revision = "5de3781c4a90"
down_revision = "2c47a8f06d31"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'paciente'")
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("patient_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_users_patient_id_patients",
            "patients",
            ["patient_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_unique_constraint("uq_users_patient_id", ["patient_id"])

    op.create_table(
        "revoked_tokens",
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("revoked_at", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )


def downgrade():
    op.drop_table("revoked_tokens")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_patient_id", type_="unique")
        batch.drop_constraint("fk_users_patient_id_patients", type_="foreignkey")
        batch.drop_column("patient_id")
