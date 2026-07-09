# S3-018: Centralized Error Handling and Logging
# One place to configure log format/level so every other file just does
# `from app.logging_config import logger` instead of setting up its own.
import logging
import sys

logger = logging.getLogger("breeze")


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.setLevel(logging.INFO)
    logger.handlers = [handler]
    logger.propagate = False
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
