from celery import Celery

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