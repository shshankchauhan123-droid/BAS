# Bank Analysis System (BAS)

> **Forensic Bank Statement Intelligence, Transaction Flow Analytics & Investigation Platform**

BAS (Bank Analysis System / ArthBodh) is an enterprise financial forensic investigation and bank statement intelligence platform engineered for law enforcement, cybercrime units, financial forensic auditors, and investigative agencies. The system ingests heterogeneous bank statements across diverse formats (**scanned PDFs, native digital PDFs, Excel spreadsheets, CSV files, and TXT ledgers**), reconstructs distorted tables through computer vision and rule-based parsing, normalizes raw transactions into canonical forensic schemas, extracts counterparty identities using zero-shot Named Entity Recognition (**GLiNER**) and local Large Language Models (**Qwen / Ollama**), and generates multi-dimensional intelligence reports featuring interactive network money-trail graphs, transaction mode breakdowns, forensic anomaly detection, and automated forensic PDF/CSV export.

---

## Table of Contents

1. [BAS Overview](#1-bas-overview)
2. [Architecture and Project Structure](#2-architecture-and-project-structure)
3. [System Requirements](#3-system-requirements)
4. [Verified Software Versions](#4-verified-software-versions)
5. [Clone the Repository](#5-clone-the-repository)
6. [Backend Setup](#6-backend-setup)
7. [Frontend Setup](#7-frontend-setup)
8. [Environment Configuration](#8-environment-configuration)
9. [PostgreSQL Database Setup Using `bas_full_backup.dump`](#9-postgresql-database-setup-using-bas_full_backupdump)
10. [Starting FastAPI and Celery with `start.py`](#10-starting-fastapi-and-celery-with-startpy)
11. [Starting the Frontend](#11-starting-the-frontend)
12. [Complete Local Run Procedure](#12-complete-local-run-procedure)
13. [Database and Application Verification](#13-database-and-application-verification)
14. [Production Deployment](#14-production-deployment)
15. [Troubleshooting Guide](#15-troubleshooting-guide)
16. [Backup and Data Security](#16-backup-and-data-security)
17. [Known Limitations and Unverified Requirements](#17-known-limitations-and-unverified-requirements)

---

## 1. BAS Overview

### 1.1 Purpose and Forensic Capabilities
Investigating financial crime, money laundering, and digital fraud requires analyzing dozens of bank statements from different financial institutions, each with proprietary statement layouts, varying column headers, multi-line narrations, and distorted scanned images. 

BAS solves this challenge by providing an automated, end-to-end forensic processing and analytical pipeline:
- **Universal Statement Ingestion**: Ingests native vector PDFs, scanned image PDFs, Excel spreadsheets (`.xlsx`, `.xls`), delimited text (`.csv`), and legacy ASCII bank ledgers (`.txt`).
- **Computer Vision & Table Extraction**: Uses a tiered extraction approach combining `pdfplumber`, `camelot`, and `PyMuPDF` with an automatic fallback to OpenCV image preprocessing and `pytesseract` OCR for scanned physical documents.
- **Header Classification & Normalization**: Automatically identifies header rows using banking keyword heuristics, standardizes aliases (e.g., `Txn Dt`, `Value Date`, `Dr/Cr`, `Withdrawal`, `Balance`), and invokes local LLM inference (**Qwen 3.5:0.8b via Ollama**) to dynamically classify non-standard header formats.
- **Zero-Shot Named Entity Recognition (GLiNER)**: Evaluates raw, messy transaction narrations out-of-band using `urchade/gliner_multi-v2.1` to isolate counterparties, classifying them into `PERSON`, `ORGANIZATION`, `MERCHANT`, `BANK`, `FINANCIAL_INSTITUTION`, `UPI_ID`, and `ACCOUNT_NUMBER`.
- **Multi-Account Relationship Mapping**: Aggregates transactions across multiple accounts and cases, rendering interactive force-directed network graphs (Apache ECharts) to trace money trails, circular fund routing, and layered transactions.
- **Forensic Financial Intelligence**: Automatically computes transaction channel distributions (UPI, NEFT, RTGS, IMPS, Cash, Cheque), flags statistical outliers ($Q_3 + 1.5 \times \text{IQR}$), identifies round-sum cash structuring clusters (smurfing/hawala indicators), tracks velocity spikes, and exports courtroom-ready forensic audit PDFs via `html2pdf.js` and Excel-compatible RFC 4180 CSVs.

---

## 2. Architecture and Project Structure

### 2.1 Architectural Overview
BAS operates on a decoupled, asynchronous, event-driven architecture:
- **Frontend SPA**: React 19 single-page application built with Vite and Tailwind CSS. Employs Apache ECharts for high-performance canvas/SVG graph visualizations and `html2pdf.js` for forensic client-side document rendering.
- **FastAPI Core API Gateway**: High-throughput asynchronous ASGI server managing authentication, session tokens, RBAC permissions, audit trails, case records, statement metadata, and transaction querying.
- **Broker & Task Queue**: RabbitMQ message broker coordinating with Celery background workers to execute compute-intensive document extraction, OCR, NER, and database ingestion out-of-band.
- **Relational Storage**: PostgreSQL database with SQLAlchemy 2.0 ORM, indexed for fast transaction filtering, date-range bounding, and counterparty aggregation.
- **Storage Subsystem**: File system storage partitioned by case ID (`backend/storage/cases/{case_id}/`), holding uploaded statements and intermediate normalized spreadsheets.

### 2.2 System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Browser (React 19 / Vite SPA)"]
        UI["Investigator UI"]
        AuthCtx["Auth Context & Token Interceptor"]
        Reports["5 Core Forensic Reports & Dynamic Dashboard"]
        ExportEngine["Export Engine (CSV with UTF-8 BOM / html2pdf.js)"]
    end

    subgraph Gateway ["FastAPI ASGI Application (Port 8000)"]
        AuthRouter["/api/v1/auth (JWT Authentication)"]
        CaseRouter["/api/v1/cases & /api/v1/io-master"]
        FileRouter["/api/v1/files (Upload & Celery Dispatch)"]
        TxRouter["/api/v1/bank-transactions (Search, Relations, Intelligence)"]
        DashRouter["/api/v1/dashboard (Dynamic KPIs)"]
        AuditRouter["/api/v1/audit-logs (Security Trails)"]
        WSRouter["/api/v1/ws (WebSocket Notifications)"]
    end

    subgraph BrokerStorage ["Storage & Message Broker"]
        DiskStorage["Physical Storage (backend/storage/cases/{case_id}/)"]
        RabbitMQ["RabbitMQ Broker (amqp://localhost:5672//)"]
    end

    subgraph WorkerEngine ["Celery Background Worker (app.tasks.process_bank_statement)"]
        Stage0["Stage 0: File Validation & Metadata Extraction"]
        Stage1["Stage 1: PDF Extraction / OCR Fallback / Excel-CSV Bypass"]
        Stage2["Stage 2: Save Intermediate Raw Excel Checkpoint"]
        Stage3["Stage 3 & 4: Header Detection & Normalization"]
        Stage5["Stage 5: Deterministic Header Mapping / Qwen LLM Fallback"]
        Stage6["Stage 6: Canonical DataFrame Transformation"]
        Stage7["Stage 7: Transaction Validation (Dates, Amounts, Balances)"]
        Stage75["Stage 7.5: GLiNER NLP Counterparty Entity Resolution"]
        Stage8["Stage 8: PostgreSQL Batch Persistence (bank_transactions)"]
    end

    subgraph Database ["PostgreSQL Relational Storage (Port 5432)"]
        DB[(PostgreSQL Database: users, cases, files, bank_transactions, audit_logs)]
    end

    UI -->|HTTPS / REST API| Gateway
    Gateway -->|Save Statement File| DiskStorage
    Gateway -->|Enqueue file_id| RabbitMQ
    RabbitMQ -->|Deliver Task| WorkerEngine
    WorkerEngine -->|Read Stored Document| DiskStorage
    WorkerEngine -->|Write Processed Transactions| DB
    Gateway -->|Query Filtered Data / KPIs| DB
    Reports -->|Fetch Data| TxRouter
    ExportEngine -->|Client Download| UI
```

### 2.3 Repository Directory Structure

```text
BAS/
├── README.md                           # Master project documentation (this file)
├── .gitignore                          # Git ignore specifications
├── database/                           # Database Backups & Artifacts
│   └── bas_full_backup.dump            # Complete PostgreSQL custom-format dump (schema + data)
├── backend/                            # FastAPI Application Root
│   ├── .env                            # Backend environment configuration (gitignored)
│   ├── alembic.ini                     # Alembic database migration configuration
│   ├── requirements.txt                # Pinned Python package dependencies (UTF-16 encoded)
│   ├── start.py                        # Development startup script for FastAPI + Celery
│   ├── note.txt                        # Architectural pipeline reference & flow diagram
│   ├── storage/                        # Application file storage root
│   │   └── cases/                      # Subfolders per case_id containing statements and raw excels
│   ├── venv312/                        # Python virtual environment (gitignored)
│   ├── alembic/                        # Database migration scripts
│   │   ├── env.py                      # Alembic runtime environment
│   │   ├── script.py.mako              # Migration generation template
│   │   └── versions/                   # 18 Migration revisions (Current Head: c8940e2f5b61)
│   └── app/                            # Backend Source Package
│       ├── __init__.py
│       ├── main.py                     # FastAPI application entry point, CORS & route registrations
│       ├── celery_app.py               # Celery app initialization, broker URL, serialization settings
│       ├── audit/                      # Audit logging module (Controller, Model, Repo, Route, Service)
│       ├── authentication/             # JWT auth endpoints (Login, Refresh, First-login password)
│       ├── bank_transactions/          # Core transaction querying, search, export & financial intelligence
│       │   ├── bank_transaction_model.py       # BankTransaction ORM model
│       │   ├── bank_transaction_repository.py  # Filtered queries, aggregations, relationship graph
│       │   ├── bank_transaction_routes.py      # REST endpoints for transaction reporting & CSV streaming
│       │   ├── bank_transaction_schema.py      # Pydantic schemas for requests/responses
│       │   ├── financial_analysis_service.py   # Statistical forensics, outliers, velocity, ratios
│       │   ├── transaction_mode_model.py       # TransactionMode schema (UPI, NEFT, IMPS, RTGS, etc.)
│       │   └── transaction_mode_service.py     # Channel identification routines
│       ├── case/                       # Case management module (CRUD, assignments, IO linkages)
│       ├── client/                     # Multi-tenant Client / Organization management
│       ├── core/                       # Core configuration & infrastructure
│       │   ├── database.py             # SQLAlchemy engine, SessionLocal, Base, ensure_database_schema
│       │   ├── roles.py                # Role constants (superadmin, client_admin, user, admin)
│       │   └── security.py             # Argon2 password hashing & JWT token encode/decode
│       ├── dashboard/                  # Dashboard statistics route (/api/v1/dashboard/statistics)
│       ├── dependencies/               # FastAPI route dependencies (get_current_user, get_db)
│       ├── files/                      # File upload, validation, physical persistence, and task trigger
│       │   ├── file_controller.py
│       │   ├── file_model.py
│       │   ├── file_repository.py
│       │   ├── file_route.py
│       │   ├── file_schema.py
│       │   └── file_service.py         # File persistence & UPLOAD_ROOT = Path("storage")
│       ├── io_master/                  # Investigating Officer directory & CRUD management
│       ├── processing/                 # Document Ingestion & Reconstruction Engine
│       │   ├── processing_service.py   # Master 9-stage orchestrator for bank statements
│       │   ├── account/                # Account metadata extractor (Regex for IFSC, AccNo, Dates)
│       │   ├── csv/                    # CSV reader & dialect detection
│       │   ├── excel/                  # Excel reader & raw Excel writer
│       │   ├── mapping/                # Header detector, normalizer, standard DataFrame generator
│       │   ├── ocr/                    # Tesseract OCR & OpenCV scanned PDF extractor
│       │   ├── pdf/                    # pdfplumber / camelot table extraction
│       │   ├── table/                  # PDF table to pandas DataFrame parser
│       │   ├── txt/                    # Formatted text / ASCII ledger processor
│       │   └── validation/             # Row-by-row debit/credit/balance validation
│       ├── services/                   # Advanced AI & Entity Intelligence Services
│       │   ├── counterparty_service.py         # Batch entity resolution coordinator
│       │   ├── gliner_entity_service.py        # Zero-shot Named Entity Recognition using GLiNER
│       │   └── ollama_counterparty_service.py  # Local LLM fallback entity identification
│       ├── tasks/                      # Registered Celery background tasks
│       │   └── bank_statement_task.py          # process_bank_statement worker entry point
│       ├── user/                       # User management, RBAC permissions, and profiles
│       └── websocket/                  # Live WebSocket notifications & connection manager
│
└── frontend/                           # React 19 + Vite Frontend Application
    ├── package.json                    # Frontend dependencies & npm scripts
    ├── package-lock.json               # Locked dependency tree
    ├── vite.config.js                  # Vite configuration & React plugin
    ├── tailwind.config.js              # Tailwind styling configuration
    ├── postcss.config.js               # PostCSS configuration
    ├── index.html                      # HTML5 root document
    ├── .env.development                # Development API URL (VITE_API_BASE_URL=http://127.0.0.1:8000)
    ├── .env.production                 # Production API URL template (VITE_API_BASE_URL=)
    └── src/                            # Frontend Application Source Code
        ├── main.jsx                    # React application bootstrapper
        ├── App.jsx                     # Root component wrapper
        ├── index.css                   # Global styles & Tailwind directives
        ├── context/                    # React Context providers (AuthContext, ThemeContext)
        ├── routes/                     # Application routing & route guards (ProtectedRoute, RoleRoute)
        ├── services/api/               # Modular API clients (client.js, auth.js, case.js, etc.)
        ├── pages/                      # Application views (auth, user, clientAdmin, superadmin)
        │   └── user/
        │       ├── UserDashboard.jsx   # Primary investigator dashboard
        │       ├── cases/              # Case listing, creation, and detail views
        │       └── reports/            # The 5 Core Analytical Forensic Reports
        │           ├── CaseFileReport.jsx                      # Report 01: Statement & Transaction Ledger
        │           ├── DynamicReportDashboard.jsx              # Report 02: Transaction Mode Wise Report
        │           ├── TransactionRelationshipReport.jsx       # Report 03: Relationship & Flow Graph
        │           ├── CounterpartyIntelligenceReport.jsx      # Report 04: Counterparty Intelligence
        │           └── FinancialTransactionIntelligenceReport.jsx # Report 05: Financial Intelligence & PDF Export
        └── components/                 # Reusable UI widgets (cards, modals, charts, tables)
```

---

## 3. System Requirements

### 3.1 Operating System Compatibility
- **Windows**: Windows 10 (64-bit), Windows 11 (64-bit), or Windows Server 2022.
- **Linux**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12, or RHEL 9.

### 3.2 Hardware Specifications
- **CPU**: 4 physical cores minimum (8 cores recommended for concurrent OCR and NLP tokenization).
- **RAM**: 8 GB minimum (16 GB recommended when hosting GLiNER and local Ollama models).
- **Disk Space**: 20 GB free space (to store uploaded case statements, intermediate Excel spreadsheets, model weights, and PostgreSQL relational data).

### 3.3 Core External Services
1. **PostgreSQL Server**: Version `14.x` to `18.x` (Remote source tested on `16.15`; Windows client tested on `18.6`).
2. **RabbitMQ Server**: Version `3.12.x` or `3.13.x` with Erlang runtime (listening on standard port `5672`).
3. **Tesseract OCR Binary**: UB-Mannheim 64-bit package for Windows or `tesseract-ocr` package for Linux. Required for scanned image PDF processing.
4. **Ollama (Optional / Fallback)**: For semantic header classification using `qwen3.5:0.8b` (listening on `http://localhost:11434`).

---

## 4. Verified Software Versions

All versions listed below have been verified directly against `backend/requirements.txt`, `backend/venv312` runtime, `frontend/package.json`, and local development environment binaries.

### 4.1 Backend Runtime & Libraries

| Software / Package | Pinned Version in Codebase | Observed Environment Version | Recommended Version | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Python** | `>=3.10, <=3.14` | `3.12.10` (`venv312`) / `3.14.3` (`venv`) | `3.12.x` | Backend runtime (Python 3.12 provides best wheel compatibility for PyTorch/OpenCV) |
| **FastAPI** | `0.141.1` | `0.141.1` | `0.141.1` | Asynchronous REST API framework |
| **Uvicorn** | `0.52.4` | `0.52.4` | `0.52.4` | High-performance ASGI web server |
| **SQLAlchemy** | `2.0.52` | `2.0.52` | `2.0.52` | Relational database ORM |
| **Alembic** | `1.19.2` | `1.19.2` | `1.19.2` | Schema migration manager (Current head: `c8940e2f5b61`) |
| **psycopg / psycopg-binary** | `3.3.5` | `3.3.5` | `3.3.5` | Modern PostgreSQL database adapter for Python |
| **Celery** | `5.6.3` | `5.6.3` | `5.6.3` | Asynchronous background task queue |
| **kombu** | `5.6.2` | `5.6.2` | `5.6.2` | AMQP messaging library powering Celery |
| **pika** | `1.4.4` | `1.4.4` | `1.4.4` | RabbitMQ communication client |
| **Pydantic** | `2.13.5` | `2.13.5` | `2.13.5` | Request validation & schema serialization |
| **pwdlib** / **argon2-cffi** | `0.3.1` / `25.1.0` | `0.3.1` / `25.1.0` | `0.3.1` / `25.1.0` | Cryptographic Argon2 password hashing |
| **python-jose** | `3.5.0` | `3.5.0` | `3.5.0` | JWT authentication encode/decode |
| **pandas** | `3.0.6` | `3.0.6` | `3.0.6` | Tabular data manipulation and validation |
| **openpyxl** | `3.1.5` | `3.1.5` | `3.1.5` | Excel workbook reader and raw generator |
| **pdfplumber** | `0.11.10` | `0.11.10` | `0.11.10` | PDF coordinate and table extraction |
| **PyMuPDF (fitz)** | `1.28.2` | `1.28.2` | `1.28.2` | High-speed PDF rendering and rasterization |
| **camelot-py** | `2.0.0` | `2.0.0` | `2.0.0` | Lattice and stream PDF table parser |
| **opencv-python-headless** | `5.0.0.93` | `5.0.0.93` | `5.0.0.93` | Image preprocessing (binarization, deskewing) |
| **pytesseract** | `0.3.13` | `0.3.13` | `0.3.13` | OCR Python wrapper |
| **gliner** | `0.2.29` | `0.2.29` | `0.2.29` | Zero-shot Named Entity Recognition |
| **torch (PyTorch)** | `2.14.1` | `2.14.1` | `2.14.1` | Deep learning execution engine for GLiNER |
| **transformers** | `5.16.1` | `5.16.1` | `5.16.1` | Hugging Face transformer models |
| **python-dotenv** | `1.2.3` | `1.2.3` | `1.2.3` | Environment variable loader |

### 4.2 Frontend Runtime & Libraries

| Package | Declared Version in `package.json` | Observed Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.x` | `v24.14.1` | JavaScript runtime environment |
| **npm** | `>= 9.x` | `11.11.0` | Package manager |
| **React** | `^19.2.8` | `19.2.8` | Core UI library |
| **React DOM** | `^19.2.8` | `19.2.8` | DOM renderer for React |
| **Vite** | `^8.2.2` | `8.2.2` | Frontend build tool and development server |
| **Tailwind CSS** | `^3.4.19` | `3.4.19` | Utility-first CSS styling framework |
| **React Router DOM** | `^7.18.3` | `7.18.3` | Client-side routing & route guards |
| **Apache ECharts** | `^6.1.0` | `6.1.0` | Force-directed graphs and financial charts |
| **html2pdf.js** | `^0.14.0` | `0.14.0` | Direct client-side forensic PDF generation |
| **SweetAlert2** | `^11.26.25` | `11.26.25` | Modal dialogs and progress feedback |
| **XLSX (SheetJS)** | `^0.18.5` | `0.18.5` | Tabular data export |
| **PostCSS** | `^8.5.28` | `8.5.28` | CSS post-processing |
| **Autoprefixer** | `^10.5.5` | `10.5.5` | Vendor prefix parser |
| **ESLint** | `^10.9.0` | `10.9.0` | Code quality and linting |

### 4.3 Database and External Binaries

| Utility / Service | Pinned / Required | Observed Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Server** | `>= 14.x` | `16.15` (Remote) | `psql -U YOUR_DB_USER -c "SELECT version();"` |
| **PostgreSQL Client (psql)** | `>= 14.x` | `18.6` (Windows) | `psql --version` |
| **pg_restore** | `>= 14.x` | `18.6` (Windows) | `pg_restore --version` |
| **RabbitMQ Server** | `>= 3.12.x` | `3.12+` (Port 5672) | `Test-NetConnection -Port 5672 localhost` |
| **Tesseract OCR** | `>= 5.0.0` | `v5.5.0` (Windows) | `& "C:\Program Files\Tesseract-OCR\tesseract.exe" --version` |

---

## 5. Clone the Repository

Clone the project from your repository hosting provider into your local development workspace.

### Windows (PowerShell)
```powershell
# Clone the repository using your repository URL
git clone <YOUR_REPOSITORY_URL> BAS

# Enter the repository root
Set-Location -Path "BAS"

# Verify repository structure
Get-ChildItem -Force
```

### Ubuntu / Linux
```bash
# Clone the repository using your repository URL
git clone <YOUR_REPOSITORY_URL> BAS

# Enter the repository root
cd BAS

# Verify repository structure
ls -la
```

---

## 6. Backend Setup

The backend requires Python (Python 3.12 recommended), a virtual environment, and specific system binaries for OCR and document handling.

### 6.1 Create and Activate Virtual Environment

#### Windows (PowerShell)
```powershell
# Navigate to the backend directory
Set-Location -Path "backend"

# Create a clean virtual environment (named venv312 to match project conventions)
python -m venv venv312

# Enable script execution if restricted
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Activate the virtual environment
.\venv312\Scripts\Activate.ps1
```

#### Ubuntu / Linux
```bash
# Navigate to the backend directory
cd backend

# Ensure Python 3 venv module is installed
sudo apt-get update && sudo apt-get install -y python3-venv python3-pip

# Create the virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate
```

### 6.2 Upgrade Pip and Install Dependencies
> [!IMPORTANT]
> The `requirements.txt` file in this repository is encoded in **UTF-16LE with BOM** (standard for Windows PowerShell output redirection). Modern `pip` automatically detects this encoding. If you experience an encoding error on older pip versions, upgrade pip first.

```bash
# Upgrade packaging tools
python -m pip install --upgrade pip setuptools wheel

# Install pinned backend dependencies
pip install -r requirements.txt
```

### 6.3 Verify Backend Dependencies
Run the following verification command to ensure all critical modules compile and import cleanly:
```bash
python -c "import fastapi, uvicorn, celery, sqlalchemy, psycopg, pydantic, pandas, pdfplumber, openpyxl, gliner; print('Core backend dependencies verified successfully.')"
```

---

## 7. Frontend Setup

The frontend is built with React 19 and Vite.

### 7.1 Install Node Dependencies
Open a separate terminal and navigate to `frontend/`:

#### Windows (PowerShell) & Ubuntu / Linux
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies strictly according to package-lock.json
npm ci
# (Or run 'npm install' if npm ci is unavailable)
```

### 7.2 Verify Frontend Compilation and Linting
Verify that the frontend builds cleanly without JSX syntax or bundling errors:

```bash
# Test the production build
npm run build

# Run ESLint validation
npm run lint
```
A successful build generates compiled static assets in `frontend/dist/`.

---

## 8. Environment Configuration

The application relies on environment variables for backend security, database connectivity, and frontend API routing.

### 8.1 Backend Environment Configuration (`backend/.env`)
Create or edit `backend/.env` with the following variables.

> [!CAUTION]
> Never commit real credentials, database passwords, or secret keys to version control. Use the safe placeholders below and supply your local or production credentials.

```dotenv
# ============================================================
# DATABASE CONFIGURATION (PostgreSQL + psycopg v3)
# ============================================================
# Format: postgresql+psycopg://<user>:<password>@<host>:<port>/<database_name>
# IMPORTANT: Special characters in passwords must be URL-encoded (e.g. '@' -> '%40', '#' -> '%23')
DATABASE_URL=postgresql+psycopg://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/YOUR_DB_NAME

# ============================================================
# JWT SECURITY & AUTHENTICATION CONFIGURATION
# ============================================================
# Generate a cryptographically secure 64-character secret using:
# python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET_KEY=YOUR_SECURE_RANDOM_SECRET_KEY_AT_LEAST_32_CHARS
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ============================================================
# GLiNER NAMED ENTITY RECOGNITION (COUNTERPARTY EXTRACTION)
# ============================================================
GLINER_ENABLED=true
GLINER_MODEL_NAME=urchade/gliner_multi-v2.1
GLINER_THRESHOLD=0.20
GLINER_BATCH_SIZE=32

# ============================================================
# OLLAMA / QWEN HEADER MAPPING & COUNTERPARTY INFERENCE (OPTIONAL)
# ============================================================
OLLAMA_BASE_URL=http://localhost:11434
QWEN_MODEL=qwen3.5:0.8b
QWEN_HEADER_CONFIDENCE_THRESHOLD=0.80

COUNTERPARTY_OLLAMA_MODEL=qwen3.5:0.8b
COUNTERPARTY_OLLAMA_BATCH_SIZE=1
COUNTERPARTY_OLLAMA_TIMEOUT=180
COUNTERPARTY_OLLAMA_ENABLED=true
COUNTERPARTY_OLLAMA_MAX_RETRIES=2
```

### 8.2 Celery Message Broker Configuration Note
> [!NOTE]
> In the current codebase, the Celery broker URL is configured in `backend/app/celery_app.py` as:
> `broker="amqp://guest:guest@localhost:5672//"`
> If running RabbitMQ on a non-default host, port, or user credentials, update the `broker` argument directly in `backend/app/celery_app.py` or modify it to read an environment variable `CELERY_BROKER_URL`.

### 8.3 Frontend Environment Configuration
Ensure `frontend/.env.development` contains the development API URL:
```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For production deployments behind an Nginx reverse proxy on the same origin, configure `frontend/.env.production`:
```dotenv
VITE_API_BASE_URL=
```
*(An empty value causes API requests to use relative paths, e.g. `/api/v1/...`).*

### 8.4 Environment Variables Reference Table

| Variable | Location | Required? | Default in Code | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `backend/.env` | **Yes** | *None (raises RuntimeError)* | PostgreSQL connection URI using modern `psycopg` driver |
| `JWT_SECRET_KEY` | `backend/.env` | **Yes** | *None (raises ValueError on token sign)* | Symmetric secret key for signing HMAC-SHA256 JWT tokens |
| `JWT_ALGORITHM` | `backend/.env` | Optional | `HS256` | Cryptographic algorithm for JWT generation |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `backend/.env` | Optional | `30` | Access token lifespan before auto-refresh |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `backend/.env` | Optional | `7` | Refresh token lifespan |
| `GLINER_ENABLED` | `backend/.env` | Optional | `true` | Enables/disables GLiNER zero-shot counterparty extraction |
| `GLINER_MODEL_NAME` | `backend/.env` | Optional | `urchade/gliner_multi-v2.1` | Hugging Face pretrained GLiNER model repository |
| `GLINER_THRESHOLD` | `backend/.env` | Optional | `0.50` (`0.20` in `.env`) | Entity detection confidence acceptance threshold |
| `GLINER_BATCH_SIZE` | `backend/.env` | Optional | `32` | Batch size for GLiNER inference |
| `OLLAMA_BASE_URL` | `backend/.env` | Optional | `http://localhost:11434` | Base URL for Ollama local LLM service |
| `QWEN_MODEL` | `backend/.env` | Optional | `qwen3.5:0.8b` | Model identifier for header classification |
| `QWEN_HEADER_CONFIDENCE_THRESHOLD`| `backend/.env` | Optional | `0.80` | Minimum confidence to accept LLM header mapping |
| `COUNTERPARTY_OLLAMA_ENABLED` | `backend/.env` | Optional | `true` | Toggles LLM fallback for counterparty resolution |
| `VITE_API_BASE_URL` | `frontend/.env*`| **Yes** | *None (throws Error in client.js)* | Base HTTP URL where frontend sends API requests |

---

## 9. PostgreSQL Database Setup Using `bas_full_backup.dump`

### 9.1 Critical Rule: Use `pg_restore`, NOT `alembic upgrade head`
> [!CRITICAL]
> **Do NOT run `alembic upgrade head` to initialize a clean database from scratch.**
>
> The repository includes a complete database backup located at:
> `database/bas_full_backup.dump` (4,292,924 bytes, ~4.1 MB).
>
> This dump is a PostgreSQL custom-format archive (`pg_dump -Fc`) containing:
> 1. Complete schema definitions, table DDL, primary keys, foreign keys, constraints, and performance indexes.
> 2. Full relational table data across all **13 database tables**.
> 3. Initial system users, roles, permissions, Investigating Officers, cases, files, and transaction mode mappings.
> 4. The `alembic_version` table already stamped at revision `c8940e2f5b61` (current repository head).
>
> Running `alembic upgrade head` on an empty database would fail to populate essential seed data and default records. Initial setup must be performed strictly by restoring `database/bas_full_backup.dump` using `pg_restore`.

### 9.2 Verified Tables in `bas_full_backup.dump`
Inspecting the dump with `pg_restore -l "database/bas_full_backup.dump"` confirms the presence of all 13 core tables, sequences, and data blocks:

| Table Name | Type | Description |
| :--- | :--- | :--- |
| `alembic_version` | Migration Tracker | Records current schema revision (`c8940e2f5b61`) |
| `users` | Core Entity | User accounts, credentials (Argon2 hashes), roles, and client associations |
| `user_permissions` | RBAC Matrix | Granular permissions mapped per user |
| `clients` | Multi-Tenant | Organization and client tenant records |
| `cases` | Portfolio | Investigative cases, case numbers, and client linkages |
| `io_master` | Directory | Investigating Officers, police stations, and contact credentials |
| `files` | Document Registry | Uploaded bank statements, processing status, metadata, and merge flags |
| `merged_file_sources` | Audit Linkage | Tracks source statements combined into merged statements |
| `bank_transactions` | Master Ledger | Normalized transaction records, GLiNER counterparty entities, dates, amounts |
| `transaction_mode` | Channel Master | Payment channels (UPI, NEFT, RTGS, IMPS, Cash, Cheque, etc.) |
| `statement_format_mappings` | Parser Cache | Cached statement layout fingerprints for instant parsing |
| `audit_logs` | Security Trail | Immutable audit logs tracking user operations and data access |
| `upload_charges_sample_20261021162931` | Ad-hoc / Metabase | Upload table created during Metabase analysis |

### 9.3 Step-by-Step Database Restoration Workflow

#### Step 1: Verify PostgreSQL Client Tools
Ensure `pg_restore` and `psql` are accessible in your system path:
```bash
pg_restore --version
psql --version
```

#### Step 2: Safe Inspection of Dump Table of Contents
Inspect the dump contents without modifying any database:
```bash
pg_restore -l "database/bas_full_backup.dump"
```

#### Step 3: Create Target Database and Role
Connect to PostgreSQL as a superuser (e.g., `postgres`):
```sql
-- Connect via psql
psql -h YOUR_DB_HOST -p 5432 -U postgres

-- Create application database user (if not already created)
CREATE USER YOUR_DB_USER WITH ENCRYPTED PASSWORD 'YOUR_DB_PASSWORD';

-- Create clean application database owned by the user
CREATE DATABASE "YOUR_DB_NAME" OWNER YOUR_DB_USER;

-- Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE "YOUR_DB_NAME" TO YOUR_DB_USER;

\q
```

#### Step 4: Execute `pg_restore`
Restore the backup into your newly created target database.

> [!WARNING]
> The source backup was originally owned by role `bas`. Always include `--no-owner` and `--no-privileges` so that restored tables are assigned to `YOUR_DB_USER` rather than failing on missing source roles.
> Never use `--clean` or `--create` against an existing shared or production database.

##### Windows (PowerShell)
```powershell
$env:PGPASSWORD = "YOUR_DB_PASSWORD"
pg_restore -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME --no-owner --no-privileges --exit-on-error "database/bas_full_backup.dump"
$env:PGPASSWORD = $null
```

##### Ubuntu / Linux
```bash
PGPASSWORD="YOUR_DB_PASSWORD" pg_restore -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME --no-owner --no-privileges --exit-on-error "database/bas_full_backup.dump"
```

#### Step 5: Grant Object Permissions
Because `--no-privileges` strips permission grants from the dump, explicitly ensure `YOUR_DB_USER` owns all objects in the `public` schema:

```sql
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "GRANT ALL ON SCHEMA public TO YOUR_DB_USER;"
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO YOUR_DB_USER;"
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO YOUR_DB_USER;"
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO YOUR_DB_USER;"
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO YOUR_DB_USER;"
```

#### Step 6: Verify Restored Schema & Tables
Verify that all 13 tables exist and contain records:
```sql
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "\dt"
```
Run a sample record count verification query:
```sql
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -c "SELECT 'users' AS table_name, count(*) AS total_rows FROM users UNION ALL SELECT 'cases', count(*) FROM cases UNION ALL SELECT 'bank_transactions', count(*) FROM bank_transactions UNION ALL SELECT 'alembic_version', count(*) FROM alembic_version;"
```

### 9.4 Alembic Migration History Reconciliation
- The restored `alembic_version` table contains the revision hash `c8940e2f5b61`.
- The codebase at `backend/alembic/versions/` contains 18 migration files, with head `c8940e2f5b61` (`c8940e2f5b61_add_superseded_status_to_files.py`).
- Because the restored database version matches the codebase migration head, running `python -m alembic current` will output `c8940e2f5b61 (head)`.
- **Do not blindly delete `alembic_version` or run `alembic stamp`**. Doing so would desynchronize Alembic from the actual database state. If new migration files are added in future code updates, running `python -m alembic upgrade head` will then properly apply only the incremental changes.

---

## 10. Starting FastAPI and Celery with `start.py`

### 10.1 Audit of `backend/start.py`
The project provides `backend/start.py` to launch the FastAPI ASGI server and Celery background worker together for local development.

```python
# Startup commands executed by backend/start.py:
BACKEND_COMMAND = [sys.executable, "-m", "uvicorn", "app.main:app", "--reload"]
CELERY_COMMAND  = [sys.executable, "-m", "celery", "-A", "app.celery_app.celery_app", "worker", "--loglevel=INFO", "--pool=solo", "--concurrency=1"]
```

#### Verified Behavioral Characteristics & Limitations:
1. **Python Interpreter Resolution**: Uses `sys.executable`. When launched from an activated virtual environment (`venv312` or `venv`), both child processes automatically inherit that exact interpreter.
2. **Working Directory Anchoring**: Computes `BASE_DIR = Path(__file__).resolve().parent` and sets `cwd=str(BASE_DIR)` in both `subprocess.Popen` calls. The script can be executed safely either from repository root (`python backend/start.py`) or from within `backend/` (`python start.py`).
3. **Storage Alignment**: Because both Uvicorn and Celery run with `cwd=backend/`, relative file paths like `UPLOAD_ROOT = Path("storage")` resolve consistently to `backend/storage/cases/{case_id}/`.
4. **Celery Solo Pool on Windows**: The `--pool=solo` parameter is mandatory on Windows OS because Windows lacks POSIX `fork()`. Running Celery with default prefork on Windows causes immediate startup crashes (`ValueError: not enough values to unpack`).
5. **Process Lifecycle & Exit Detection**: A 1-second polling loop checks `process.poll()`. If either process terminates, `start.py` prints a warning with the exit code and invokes `stop_processes()`.
6. **Graceful Shutdown**: Intercepts `KeyboardInterrupt` (`Ctrl + C`), calls `process.terminate()`, waits up to 10 seconds, and escalates to `process.kill()` if a process hangs.
7. **Windows Reload Limitation**: When Uvicorn runs with `--reload`, it spawns an inner child worker. On Windows, terminating the parent Uvicorn process does not always terminate the child process tree, which can leave port 8000 locked. If port 8000 remains occupied after exit, kill the orphaned process manually (see [Troubleshooting](#15-troubleshooting-guide)).
8. **Readiness vs Launch Indicator**: The console messages printed upon execution (`FastAPI process started`, `http://127.0.0.1:8000`) indicate that the processes were spawned by the OS. They do **not** confirm that Uvicorn has finished binding to port 8000, that RabbitMQ has accepted the Celery connection, or that PostgreSQL is reachable. Health probes must be verified independently.
9. **Development-Only Tool**: `start.py` is designed strictly for local development. It is not a compiled executable or production service supervisor.

### 10.2 How to Run `start.py`

#### Windows (PowerShell)
```powershell
# Navigate to backend directory
Set-Location -Path "backend"

# Activate the virtual environment
.\venv312\Scripts\Activate.ps1

# Launch FastAPI and Celery
python start.py
```

#### Ubuntu / Linux
```bash
# Navigate to backend directory
cd backend

# Activate the virtual environment
source venv/bin/activate

# Launch FastAPI and Celery
python start.py
```

### 10.3 Alternative: Running Services in Separate Terminals
For isolated log inspection during debugging, run the services in dedicated terminals:

- **Terminal 1 (FastAPI Server)**:
  ```bash
  cd backend
  # Activate venv
  python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```
- **Terminal 2 (Celery Worker)**:
  - Windows:
    ```powershell
    cd backend
    .\venv312\Scripts\Activate.ps1
    python -m celery -A app.celery_app.celery_app worker --loglevel=INFO --pool=solo --concurrency=1
    ```
  - Linux:
    ```bash
    cd backend
    source venv/bin/activate
    celery -A app.celery_app.celery_app worker --loglevel=INFO --concurrency=4
    ```

---

## 11. Starting the Frontend

### 11.1 Development Server
Start the Vite development server in a separate terminal:

```bash
cd frontend
npm run dev
```

*Expected output:*
```text
  VITE v8.2.2  ready in 350 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in your browser. The application will render the login interface.

### 11.2 Frontend Production Preview
To test the compiled production build locally:
```bash
cd frontend
npm run build
npm run preview
```

---

## 12. Complete Local Run Procedure

Follow this sequential procedure to boot the entire platform from a cold system state:

```mermaid
flowchart LR
    Step1["1. Start PostgreSQL (Port 5432)"] --> Step2["2. Start RabbitMQ (Port 5672)"]
    Step2 --> Step3["3. Restore DB Dump (pg_restore)"]
    Step3 --> Step4["4. Start Backend (start.py)"]
    Step4 --> Step5["5. Start Frontend (npm run dev)"]
    Step5 --> Step6["6. Open UI (http://localhost:5173)"]
```

### Sequential Startup Execution

1. **Start Database and Broker Daemons**:
   - **Windows**:
     ```powershell
     Start-Service *postgres*
     Start-Service *rabbit*
     ```
   - **Linux**:
     ```bash
     sudo systemctl start postgresql
     sudo systemctl start rabbitmq-server
     ```

2. **Verify Port Availability**:
   Ensure ports `5432` (Postgres) and `5672` (RabbitMQ) are listening:
   - **Windows**:
     ```powershell
     Test-NetConnection -ComputerName localhost -Port 5432
     Test-NetConnection -ComputerName localhost -Port 5672
     ```
   - **Linux**:
     ```bash
     nc -zv localhost 5432
     nc -zv localhost 5672
     ```

3. **Verify Database Restoration**:
   Confirm that the database has been restored from `database/bas_full_backup.dump` (see [Section 9](#9-postgresql-database-setup-using-bas_full_backupdump)).

4. **Launch Backend Services (Terminal 1)**:
   ```powershell
   cd backend
   .\venv312\Scripts\Activate.ps1
   python start.py
   ```

5. **Launch Frontend Dev Server (Terminal 2)**:
   ```bash
   cd frontend
   npm run dev
   ```

6. **Access Platform**:
   Navigate to `http://localhost:5173` in your web browser.

---

## 13. Database and Application Verification

Perform these multi-tier health checks to verify that the application is fully operational.

### 13.1 Service Process & Port Verification

| Service | Port | Process Check (Windows PowerShell) | Process Check (Linux) |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `5432` | `Get-Process -Name postgres -ErrorAction SilentlyContinue` | `pgrep -l postgres` |
| **RabbitMQ** | `5672` | `Get-Service *rabbit*` | `systemctl is-active rabbitmq-server` |
| **FastAPI** | `8000` | `Get-NetTCPConnection -LocalPort 8000 -State Listen` | `ss -tulpn \| grep 8000` |
| **Frontend** | `5173` | `Get-NetTCPConnection -LocalPort 5173 -State Listen` | `ss -tulpn \| grep 5173` |

### 13.2 HTTP API Health Probes

```bash
# 1. Gateway root ping probe
curl -s http://127.0.0.1:8000/
# Expected: {"message": "BAS Backend is running"}

# 2. Service liveness health probe
curl -s http://127.0.0.1:8000/health
# Expected: {"status": "healthy"}

# 3. Interactive OpenAPI documentation
# Open http://127.0.0.1:8000/docs in your browser
```

### 13.3 Database Connectivity Smoke Test
Test database connectivity by executing a login authentication request:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"test_user\", \"password\": \"test_password\"}"
```
*Expected response:*
- If credentials exist and match: `200 OK` with `access_token` and `refresh_token`.
- If credentials do not match: `401 Unauthorized` with `{"detail": "Incorrect username or password"}`.
- If database connection fails: `500 Internal Server Error` with `{"detail": "Internal Server Error: could not connect to server"}`.

### 13.4 Celery Worker & Task Verification
Inspect the Celery worker terminal logs. Verify that:
1. Celery connected to the broker: `connected to amqp://guest:**@localhost:5672//`
2. The bank statement processing task is registered:
   ```text
   [tasks]
     . app.tasks.bank_statement_task.process_bank_statement
   ```

---

## 14. Production Deployment

### 14.1 Key Architecture Differences: Development vs Production

| Component | Development Environment | Production Deployment |
| :--- | :--- | :--- |
| **FastAPI Runner** | `python start.py` (single Uvicorn process with `--reload`) | Gunicorn supervisor with multiple Uvicorn worker processes (`uvicorn.workers.UvicornWorker`) |
| **Celery Worker** | Single process (`--pool=solo --concurrency=1` on Windows) | Multi-worker daemon managed via `systemd` or `supervisor` (`--concurrency=4+`) |
| **Frontend** | Vite development server (`npm run dev`) on port 5173 | Pre-compiled static assets (`npm run build`) served via Nginx |
| **Reverse Proxy** | Direct browser-to-port connections | Nginx terminating SSL/TLS, routing `/api/` to backend, serving static files |
| **File Storage** | Local directory (`backend/storage/cases/`) | Persistent, snapshot-backed block storage (EBS / RAID 10) |

### 14.2 Frontend Production Build
Generate optimized static production assets:
```bash
cd frontend
npm run build
```
Output directory: `frontend/dist/`.

### 14.3 Backend Production Runner (Linux)
In production on Linux, run Uvicorn under Gunicorn:
```bash
cd backend
source venv/bin/activate
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

### 14.4 Celery Production Service (`systemd`)
Create a `systemd` service unit at `/etc/systemd/system/bas-celery.service`:

```ini
[Unit]
Description=BAS Celery Background Worker
After=network.target rabbitmq-server.service postgresql.service

[Service]
Type=simple
User=bas_user
Group=bas_user
WorkingDirectory=/opt/bas/backend
EnvironmentFile=/opt/bas/backend/.env
ExecStart=/opt/bas/backend/venv/bin/celery -A app.celery_app.celery_app worker --loglevel=INFO --concurrency=4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bas-celery
sudo systemctl start bas-celery
```

### 14.5 Reverse Proxy & SSL Configuration (Nginx)
Create an Nginx server block at `/etc/nginx/sites-available/bas.conf`:

```nginx
server {
    listen 80;
    server_name bas.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bas.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/bas.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bas.yourdomain.com/privkey.pem;

    # Allow large bank statement PDF uploads (up to 100MB)
    client_max_body_size 100M;

    # Serve compiled frontend static files
    root /opt/bas/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Proxy WebSocket connections
    location /api/v1/ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 15. Troubleshooting Guide

| Symptom / Error | Likely Root Cause | Diagnostic Command | Safe Resolution Steps |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL is not configured` | Missing or misnamed `.env` file in `backend/` directory. | `Test-Path .\backend\.env` | Ensure `.env` is situated in `backend/` and defines `DATABASE_URL=postgresql+psycopg://...`. |
| `connection to server at "localhost", port 5432 failed: Connection refused` | PostgreSQL service is stopped or port 5432 is blocked. | `Get-Service *postgres*` or `Test-NetConnection -Port 5432 localhost` | Start PostgreSQL service via `Start-Service *postgres*` or `sudo systemctl start postgresql`. |
| `password authentication failed for user "..."` | Incorrect username/password, or special characters in password are not URL-encoded. | Connect manually: `psql -U YOUR_DB_USER -h localhost` | URL-encode reserved characters in `DATABASE_URL` (e.g., `@` becomes `%40`, `#` becomes `%23`). |
| `pg_restore: error: could not execute query: ERROR: role "bas" does not exist` | Dump restored without stripping source role ownership. | Inspect restore command flags | Always add `--no-owner --no-privileges` to `pg_restore`. |
| `pg_restore: error: relation "users" already exists` | Attempting to restore dump into a database that already contains tables. | `psql -U YOUR_DB_USER -d YOUR_DB_NAME -c "\dt"` | Restore into a clean, empty target database. Never restore over existing data. |
| `alembic: error: Can't locate revision identified by '...'` | Restored database has an `alembic_version` not present in codebase migration files. | `python -m alembic heads` vs `python -m alembic current` | Verify that the migration tree in `backend/alembic/versions/` matches the restored database head (`c8940e2f5b61`). |
| Celery tasks stuck in `QUEUED`; never transition to `PROCESSING` | RabbitMQ broker is down, or Celery worker process is not running. | `Get-Service *rabbit*` and check Celery logs | 1. Start RabbitMQ (`Start-Service RabbitMQ`).<br>2. Start worker: `python -m celery -A app.celery_app.celery_app worker --loglevel=INFO -P solo`. |
| Celery worker crashes on Windows with `ValueError: not enough values to unpack` | Celery started without `--pool=solo` on Windows OS. | Inspect Celery startup command | Celery on Windows requires `-P solo` or `--pool=solo` because POSIX fork is unsupported. |
| `tesseract is not installed or it's not in your PATH` | Tesseract OCR binary missing during scanned PDF table extraction. | Windows: `where.exe tesseract`<br>Linux: `which tesseract` | Install UB-Mannheim Tesseract OCR to `C:\Program Files\Tesseract-OCR\` and add it to system `PATH`. |
| `Failed to load GLiNER model 'urchade/gliner_multi-v2.1'` | No internet access during first-run model download from Hugging Face. | Check Celery worker terminal logs | Connect to internet for first run to allow weights (~1.4 GB) to download to `~/.cache/huggingface/hub/`. For offline use, pre-populate this cache. |
| Port `8000` is already in use (`Errno 10048` or `EADDRINUSE`) | An orphaned Uvicorn process is still running in the background. | `netstat -ano \| findstr 8000` | Terminate process: Windows: `taskkill /F /PID <PID>`<br>Linux: `kill -9 <PID>`. |
| `VITE_API_BASE_URL is not configured` | Missing `.env.development` or `.env.production` in `frontend/`. | Check `frontend/.env.development` | Create `frontend/.env.development` with `VITE_API_BASE_URL=http://127.0.0.1:8000` and restart Vite. |
| `CORS error: No 'Access-Control-Allow-Origin' header present` | Frontend running on an origin not permitted by `backend/app/main.py`. | Inspect browser Console / Network tab | Ensure frontend runs on `localhost` or `127.0.0.1` on allowed ports (`5173`, `5174`, `3000`), or serve via reverse proxy under identical origin. |
| `413 Request Entity Too Large` on upload | Statement file exceeds upload size limit (100 MB in code, or Nginx client limit). | Inspect HTTP status in browser Network tab | If using Nginx, configure `client_max_body_size 100M;`. In development, ensure file is $\le$ 100 MB. |
| `ImportError: DLL load failed while importing encodingdb: An Application Control policy has blocked this file` | Windows Defender Application Control (WDAC) or AppLocker blocked native `.pyd` libraries in Camelot/Playa. | Run: `python -c "import camelot"` | Unblock DLLs in PowerShell: `Get-ChildItem -Path .\backend\venv312 -Recurse \| Unblock-File` or execute under Linux/WSL2. |

---

## 16. Backup and Data Security

### 16.1 Automated Logical Database Backups
To take a logical backup of the BAS database using custom-format compression:

#### Windows (PowerShell)
```powershell
$backupDate = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "bas_backup_$backupDate.dump"
$env:PGPASSWORD = "YOUR_DB_PASSWORD"
pg_dump -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -Fc -f $backupFile YOUR_DB_NAME
$env:PGPASSWORD = $null
Write-Host "Database backup saved to $backupFile"
```

#### Ubuntu / Linux
```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="YOUR_DB_PASSWORD" pg_dump -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -Fc -f "bas_backup_${BACKUP_DATE}.dump" YOUR_DB_NAME
```

### 16.2 Physical File Storage Backups
Case statement uploads and normalized Excel files are stored on disk in `backend/storage/cases/{case_id}/`.
- Ensure this directory is included in regular file system backups or mounted on persistent redundant block storage (e.g., AWS EBS, Azure Managed Disk).
- Exclude ephemeral temp files (`*.tmp`, lock files) when creating archives.

### 16.3 Data Security Best Practices
- **Restrict Environment Permissions**: On Linux, set restrictive file permissions on the backend environment configuration:
  ```bash
  chmod 600 backend/.env
  ```
- **Secret Key Rotation**: Use high-entropy keys for `JWT_SECRET_KEY`. Never use placeholder strings in production.
- **Privacy & PII Protection**: Account numbers are masked in application logs. Exported CSV files and forensic PDFs should be stored in encrypted folders in accordance with investigative data governance regulations.
- **Version Control Hygiene**: Never commit `*.dump` files or `.env` files containing real production data to public version control.

---

## 17. Known Limitations and Unverified Requirements

To ensure technical transparency, the following characteristics, constraints, and unverified assumptions are explicitly documented:

1. **`backend/start.py` Process Management**:
   - `start.py` is a convenience script for development only. It does not provide production process supervision, daemonization, automatic worker scaling, or clustering.
   - On Windows, Uvicorn running with `--reload` spawns a child worker that may not terminate when `start.py` exits, occasionally leaving port 8000 occupied.
   - Console startup banners indicate that processes have launched, not that health checks or database handshakes have completed.
2. **Celery Worker Concurrency on Windows**:
   - Due to the absence of POSIX `fork()` on Windows, Celery must run with `--pool=solo` and `--concurrency=1`. This means document processing tasks execute sequentially on Windows. Multi-threaded or multi-worker concurrency requires Linux or Docker.
3. **Hardcoded Broker URL in Celery App**:
   - `backend/app/celery_app.py` directly defines `broker="amqp://guest:guest@localhost:5672//"`. While suitable for default local installations, pointing to a remote RabbitMQ server requires modifying this file or updating it to read `CELERY_BROKER_URL` from the environment.
4. **Ad-Hoc Metabase Table in Database Dump**:
   - The backup dump `bas_full_backup.dump` contains the table `upload_charges_sample_20261021162931` (13 columns, row-level sequence `_mb_row_id`). This table was generated during ad-hoc Metabase exploratory analysis and is not mapped to any active SQLAlchemy ORM model or backend endpoint. It is harmless to leave intact or can be dropped if not needed.
5. **GLiNER Model Cold-Start**:
   - GLiNER (`urchade/gliner_multi-v2.1`) requires an initial download of approximately 1.4 GB of model weights from Hugging Face on its first invocation. Systems in air-gapped or restricted offline forensic environments must have this model pre-cached in `~/.cache/huggingface/hub/`.
6. **Alembic History Synchronization**:
   - The dump is stamped at migration revision `c8940e2f5b61`. Do not run `alembic upgrade head` on an empty database during initial setup, as Alembic migrations do not contain seed data or full schema history for all ad-hoc objects. Always restore using `pg_restore`.

---

*Bank Analysis System (BAS) — Forensic Document Intelligence & Financial Analytics Platform.*