import sys
import traceback

def test_fastapi():
    try:
        from app.main import app
        print("FastAPI app loaded successfully.")
    except Exception as e:
        print("FastAPI app failed to load:")
        traceback.print_exc()
        sys.exit(1)

def test_celery():
    try:
        from app.tasks.celery_worker import celery_app
        print("Celery app loaded successfully.")
    except Exception as e:
        print("Celery app failed to load:")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_fastapi()
    test_celery()
