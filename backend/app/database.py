import os

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

from app.logging_config import logger  # S3-018

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)


def init_db():
    SQLModel.metadata.create_all(engine)


def get_db():
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            # S3-018 belt and suspenders rollback. Routers commit explicitly
            # so there's normally nothing uncommited but this cover any future route
            # that flushes without committting before erroring.
            logger.error("DB session rolled back due to unhandled exception")
            session.rollback()
            raise
