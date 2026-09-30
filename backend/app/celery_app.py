from celery import Celery

# Ensure all SQLAlchemy models are registered in the Celery worker process
import app.user.user_model  # noqa: F401
import app.case.case_model  # noqa: F401
import app.io_master.io_master_model  # noqa: F401
import app.files.file_model  # noqa: F401
import app.bank_transactions.bank_transaction_model  # noqa: F401
import app.models.statement_format_mapping  # noqa: F401

celery_app = Celery(
    "bas",
    broker="amqp://guest:guest@localhost:5672//",
    backend="rpc://",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=False,

    task_track_started=True,

    task_acks_late=True,
    task_reject_on_worker_lost=True,

    worker_prefetch_multiplier=1,

    broker_connection_retry_on_startup=True,

    # Load our tasks
    imports=[
        "app.tasks.bank_statement_task",
    ],
)