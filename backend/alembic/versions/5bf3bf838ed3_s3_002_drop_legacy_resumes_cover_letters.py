"""s3_002_drop_legacy_resumes_cover_letters

Revision ID: 5bf3bf838ed3
Revises: c50c23a5030e
Create Date: 2026-07-11 20:36:47.670861

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5bf3bf838ed3'
down_revision: Union[str, Sequence[str], None] = 'c50c23a5030e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_resumes_user_id", table_name="resumes")
    op.drop_table("resumes")

    op.drop_index("ix_cover_letters_job_id", table_name="cover_letters")
    op.drop_index("ix_cover_letters_user_id", table_name="cover_letters")
    op.drop_table("cover_letters")

    op.drop_column("users", "open_to_relocation")


def downgrade() -> None:
    op.add_column("users", sa.Column("open_to_relocation", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "cover_letters",
        sa.Column("id", sa.VARCHAR(), primary_key=True),
        sa.Column("user_id", sa.VARCHAR(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.VARCHAR(), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("cover_letter_text", sa.VARCHAR(), nullable=False),
        sa.Column("file_name", sa.VARCHAR()),
        sa.Column("file_url", sa.VARCHAR()),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    )

    op.create_table(
        "resumes",
        sa.Column("id", sa.VARCHAR(), primary_key=True),
        sa.Column("user_id", sa.VARCHAR(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.VARCHAR(), sa.ForeignKey("jobs.id")),
        sa.Column("file_name", sa.VARCHAR()),
        sa.Column("file_url", sa.VARCHAR()),
        sa.Column("resume_text", sa.VARCHAR()),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
    )
