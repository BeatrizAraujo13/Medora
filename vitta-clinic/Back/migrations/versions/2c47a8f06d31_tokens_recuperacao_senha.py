"""Adiciona solicitações temporárias de redefinição de senha."""

from alembic import op
import sqlalchemy as sa


revision = "2c47a8f06d31"
down_revision = "a1c7e4d29f60"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "password_reset_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("email_digest", sa.String(length=64), nullable=False),
        sa.Column("ip_digest", sa.String(length=64), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=True),
        sa.Column("used_at", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index(
        "ix_password_reset_requests_email_digest",
        "password_reset_requests",
        ["email_digest"],
    )
    op.create_index(
        "ix_password_reset_requests_ip_digest",
        "password_reset_requests",
        ["ip_digest"],
    )
    op.create_index(
        "ix_password_reset_requests_created_at",
        "password_reset_requests",
        ["created_at"],
    )


def downgrade():
    op.drop_index(
        "ix_password_reset_requests_created_at",
        table_name="password_reset_requests",
    )
    op.drop_index(
        "ix_password_reset_requests_ip_digest",
        table_name="password_reset_requests",
    )
    op.drop_index(
        "ix_password_reset_requests_email_digest",
        table_name="password_reset_requests",
    )
    op.drop_table("password_reset_requests")
