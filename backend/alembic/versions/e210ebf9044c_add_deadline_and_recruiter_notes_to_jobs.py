"""add_deadline_and_recruiter_notes_to_jobs

Revision ID: e210ebf9044c
Revises: f33ee90e7999
Create Date: 2026-07-14 17:08:44.855213

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e210ebf9044c"
down_revision: Union[str, Sequence[str], None] = "f33ee90e7999"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("application_deadline", sa.Date(), nullable=True))
    op.add_column("jobs", sa.Column("recruiter_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "recruiter_notes")
    op.drop_column("jobs", "application_deadline")
