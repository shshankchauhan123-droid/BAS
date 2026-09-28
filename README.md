# BAS

A local Windows development setup for the Anti-Drone case and bank-statement application. The backend is FastAPI with PostgreSQL; RabbitMQ and Celery process uploaded files; the frontend is React with Vite.

## Versions Used

The current development environment was checked with:

| Component | Version |
| --- | --- |
| Python | 3.14.3 |
| FastAPI | 0.141.1 |
| SQLAlchemy | 2.0.52 |
| Alembic | 1.19.2 |
| Celery | 5.6.3 |
| Node.js | 24.14.1 |
| npm | 11.11.0 |
| React | 19.2.8 |
| Vite | 8.2.2 |
| PostgreSQL | 18.6 |

Use Python 3.14.3, Node.js 24.14.1, and PostgreSQL 18.6 to match the checked environment. Python package versions are pinned in [backend/requirements.txt](backend/requirements.txt); frontend dependencies are locked in [frontend/package-lock.json](frontend/package-lock.json). RabbitMQ is required for background processing. The application uses the local broker URL `amqp://guest:guest@localhost:5672//` in [backend/app/celery_app.py](backend/app/celery_app.py).

## Prerequisites

Install Python 3.14.3, Node.js 24.14.1 (npm is included), PostgreSQL 18.6, and RabbitMQ for Windows. Ensure the PostgreSQL and RabbitMQ Windows services are running. The backend connects to PostgreSQL on `localhost:5432` unless `DATABASE_URL` specifies otherwise.

Run the commands below in PowerShell from the repository root (`C:\antidrone`). Backend commands must be run from `backend` because that is where the application loads its `.env` file.

Check the installed runtimes:

```powershell
python --version
node --version
npm --version
psql --version
```

Expected versions are shown in the table above.

## Backend Setup

Create the virtual environment and install the pinned packages:

```powershell
python -m venv .\backend\venv
.\backend\venv\Scripts\python.exe -m pip install --upgrade pip
.\backend\venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
```

Create a PostgreSQL role and database. Connect to the local server as a PostgreSQL administrator:

```powershell
psql -U postgres -h localhost -p 5432 -d postgres
```

At the `psql` prompt, create a local application role and database. Replace the example password with your own; use a URL-encoded password in `DATABASE_URL` if it contains reserved URL characters.

```sql
CREATE ROLE antidrone_app LOGIN PASSWORD 'choose_a_local_password';
CREATE DATABASE BAS
OWNER antidrone_app;
\q
```

Create `backend/.env` (for example, run `notepad .\backend\.env` from the repository root) with:

```dotenv
DATABASE_URL=postgresql+psycopg://antidrone_app:choose_a_local_password@localhost:5432/antidrone
JWT_SECRET_KEY=paste_a_unique_random_secret_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

Generate a suitable JWT secret with the project interpreter, then paste its output as `JWT_SECRET_KEY`:

```powershell
.\backend\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Do not commit `.env` files or share the JWT secret. The backend requires both `DATABASE_URL` and `JWT_SECRET_KEY`. The broker URL is currently configured in code rather than in `.env`.

## Database Migrations

With `backend/.env` created and PostgreSQL running, apply the checked-in migrations:

```powershell
Set-Location .\backend
.\venv\Scripts\python.exe -m alembic heads
.\venv\Scripts\python.exe -m alembic upgrade head
```

The migration tree currently has one head, `5fe1c25fd22e`. The statement-format-mapping table is created in the earlier `9d58368e8240` revision; the head migration is currently a no-op. For an existing database, take a backup before upgrading. One historical migration backfills ownership for existing cases and requires an existing user if such cases are present.

## Run the Application

Keep these processes running in separate PowerShell terminals, all opened from `C:\antidrone`.

**1. API server**

```powershell
Set-Location .\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**2. Celery worker**

```powershell
Set-Location .\backend
.\venv\Scripts\python.exe -m celery -A app.celery_app.celery_app worker --loglevel=INFO --pool=solo
```

The worker needs RabbitMQ running at `localhost:5672`. If a Windows service is stopped, check its service name with `Get-Service *postgres*` or `Get-Service *rabbit*`, then start the matching service from an elevated PowerShell window.

**3. Frontend**

Create `frontend/.env.development` (for example, `notepad .\frontend\.env.development`) containing:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then start Vite:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The frontend throws an error on startup if `VITE_API_BASE_URL` is missing. The API allows browser requests from `localhost:5173` and `127.0.0.1:5173`.

## Verify

- API health: <http://127.0.0.1:8000/health>
- Interactive API docs: <http://127.0.0.1:8000/docs>
- Frontend: the Vite URL shown in the frontend terminal
- Frontend production build: from `frontend`, run `npm run build`

The production build succeeds in the checked-out project. `npm run lint` currently reports existing lint errors in several frontend files; it is not a clean check at this revision. The backend `test_*.py` files are database-backed diagnostic scripts, not a general pytest suite; several use a hard-coded file ID of `102` and require corresponding local data.

## Current Processing Scope

User signup/login, case management, file upload, and transaction APIs are exposed by the backend. Upload files are stored under `backend/storage/` and queued through Celery. The upload validator accepts several extensions, but the current bank-statement processing task implements PDF processing only; a non-PDF upload will not successfully complete processing.