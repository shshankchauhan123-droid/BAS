
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

BACKEND_COMMAND = [
    sys.executable,
    "-m",
    "uvicorn",
    "app.main:app",
    "--reload",
]

CELERY_COMMAND = [
    sys.executable,
    "-m",
    "celery",
    "-A",
    "app.celery_app.celery_app",
    "worker",
    "--loglevel=INFO",
    "--pool=solo",
    "--concurrency=1",
]

processes = []


def stop_processes():
    """Stop both services gracefully."""
    print("\nStopping BAS backend services...")

    for process in processes:
        if process.poll() is None:
            process.terminate()

    for process in processes:
        if process.poll() is None:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

    print("BAS backend services stopped.")


def main():
    print("=" * 55)
    print("       BAS BACKEND STARTUP")
    print("=" * 55)
    print(f"Backend directory: {BASE_DIR}")
    print("Starting FastAPI and Celery...\n")

    try:
        # Start FastAPI
        backend = subprocess.Popen(
            BACKEND_COMMAND,
            cwd=str(BASE_DIR),
        )
        processes.append(backend)
        print(f"FastAPI process started (PID: {backend.pid})")

        # Start Celery worker
        worker = subprocess.Popen(
            CELERY_COMMAND,
            cwd=str(BASE_DIR),
        )
        processes.append(worker)
        print(f"Celery process started (PID: {worker.pid})")

        print("\nStartup commands launched.")
        print("FastAPI: http://127.0.0.1:8000")
        print("API docs: http://127.0.0.1:8000/docs")
        print("Press Ctrl+C to stop both services.\n")

        while True:
            for name, process in [
                ("FastAPI", backend),
                ("Celery", worker),
            ]:
                exit_code = process.poll()
                if exit_code is not None:
                    print(
                        f"\nWARNING: {name} stopped "
                        f"with exit code {exit_code}."
                    )
                    return

            time.sleep(1)

    except KeyboardInterrupt:
        print("\nShutdown requested.")

    except Exception as exc:
        print(f"\nStartup error: {exc}")

    finally:
        stop_processes()


if __name__ == "__main__":
    main()
