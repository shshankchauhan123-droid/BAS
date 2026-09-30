from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.files.file_repository import get_file_by_id, update_file
from app.processing.processing_service import process_bank_statement_first_stage

# Import related models to ensure SQLAlchemy registers them in the metadata
# before ORM operations (like flush/commit) run in this isolated Celery worker context.
from app.case.case_model import Case
from app.user.user_model import User
from app.io_master.io_master_model import IOMaster


@celery_app.task(
    bind=True,
    name="app.tasks.process_bank_statement",
)
def process_bank_statement(self, file_id: int):
    print("============================================================")
    print("BANK STATEMENT PROCESSING STARTED")
    print("============================================================")
    print(f"FILE ID: {file_id}")
    print("STATUS: QUEUED -> PROCESSING\n")

    db = SessionLocal()
    try:
        process_bank_statement_first_stage(db, file_id)

    except Exception as e:
        print("============================================================")
        print("STAGE FAILED")
        print("============================================================")
        print(f"Error: {str(e)}")
        print("============================================================")

        # Roll back the current failed transaction so we can use the session again
        db.rollback()

        # Attempt to update the file status to FAILED
        try:
            file_record = get_file_by_id(db, file_id)
            if file_record:
                file_record.status = "FAILED"
                file_record.error_message = str(e)
                update_file(db, file_record)
        except Exception as inner_e:
            print(f"Failed to update file status to FAILED: {str(inner_e)}")

        raise e

    finally:
        db.close()