"""add interview prep notes to jobs

Revision ID: f33ee90e7999
Revises: 5bf3bf838ed3
Create Date: 2026-07-13 15:38:17.456310

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f33ee90e7999"
down_revision: Union[str, Sequence[str], None] = "5bf3bf838ed3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "jobs", sa.Column("interview_prep_questions", sa.String(), nullable=True)
    )
    op.add_column(
        "jobs", sa.Column("interview_prep_talking_points", sa.String(), nullable=True)
    )
    op.add_column(
        "jobs", sa.Column("interview_prep_logistics", sa.String(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("jobs", "interview_prep_logistics")
    op.drop_column("jobs", "interview_prep_talking_points")
    op.drop_column("jobs", "interview_prep_questions")
