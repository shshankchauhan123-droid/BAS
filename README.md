# Bank Analysis System (BAS)

> **Forensic Bank Statement Intelligence, Transaction Flow Analytics & Investigation Platform**

BAS (Bank Analysis System) is an enterprise financial forensic investigation and bank statement intelligence platform designed for law enforcement, cyber crime cells, financial forensic auditors, and investigative agencies. The system ingests heterogeneous bank statements across diverse formats (**scanned PDFs, native digital PDFs, Excel spreadsheets, CSV files, and TXT ledgers**), reconstructs distorted tables through computer vision and rule-based parsing, normalizes raw transactions into canonical forensic schemas, extracts counterparty identities using zero-shot Named Entity Recognition (**GLiNER**) and local Large Language Models (**Qwen / Ollama**), and generates multi-dimensional intelligence reports featuring interactive network money-trail graphs, transaction mode breakdowns, anomaly detection, and automated forensic PDF/CSV export.

---

## Table of Contents

1. [Executive Architecture & Pipeline](#1-executive-architecture--pipeline)
2. [Verified Technology Stack & Versions](#2-verified-technology-stack--versions)
3. [Repository Directory Structure](#3-repository-directory-structure)
4. [Prerequisites & System Requirements](#4-prerequisites--system-requirements)
5. [Step-by-Step Installation Guide](#5-step-by-step-installation-guide)
   - [A. Clone the Repository](#a-clone-the-repository)
   - [B. Backend Setup (Python Virtual Environment)](#b-backend-setup-python-virtual-environment)
   - [C. Frontend Setup (React & Vite)](#c-frontend-setup-react--vite)
   - [D. Environment Variables Configuration](#d-environment-variables-configuration)
   - [E. Database Setup & Alembic Migrations](#e-database-setup--alembic-migrations)
   - [F. RabbitMQ Message Broker Setup](#f-rabbitmq-message-broker-setup)
   - [G. OCR, NLP & LLM Model Provisioning](#g-ocr-nlp--llm-model-provisioning)
6. [How to Run the Entire System](#6-how-to-run-the-entire-system)
   - [A. Startup Sequence (Multi-Terminal)](#a-startup-sequence-multi-terminal)
   - [B. Verification & Health Checks](#b-verification--health-checks)
   - [C. Safe Shutdown Sequence](#c-safe-shutdown-sequence)
7. [Core Application Features & Investigation Workflows](#7-core-application-features--investigation-workflows)
   - [A. Role-Based Access Control (RBAC)](#a-role-based-access-control-rbac)
   - [B. Case Management & IO Master](#b-case-management--io-master)
   - [C. The 9-Stage Document Processing Pipeline](#c-the-9-stage-document-processing-pipeline)
   - [D. The 5 Core Forensic Intelligence Reports](#d-the-5-core-forensic-intelligence-reports)
8. [Comprehensive API Endpoints Reference](#8-comprehensive-api-endpoints-reference)
9. [Troubleshooting & Diagnostics Guide](#9-troubleshooting--diagnostics-guide)
10. [Testing, Linting & Verification](#10-testing-linting--verification)
11. [Production Deployment & Operational Considerations](#11-production-deployment--operational-considerations)

---

## 1. Executive Architecture & Pipeline

BAS operates on a decoupled, asynchronous, event-driven microservices architecture:
- **Frontend SPA**: React 19 single-page application built with Vite, styled with Tailwind CSS, utilizing Apache ECharts for high-performance canvas/SVG visualizations, and `html2pdf.js` for forensic client-side document rendering.
- **FastAPI Core API Gateway**: High-throughput asynchronous ASGI server managing authentication, session tokens, audit trails, case records, statement metadata, and transaction querying.
- **Broker & Task Queue**: RabbitMQ message broker coordinating with Celery background workers to execute compute-intensive document extraction, OCR, NER, and database ingestion out-of-band.
- **Computer Vision & Parsing Engine**: Dual-engine extraction utilizing `pdfplumber` / `camelot` / `PyMuPDF` for digital PDFs, cascading automatically to OpenCV preprocessing and `pytesseract` for scanned or low-resolution image statements.
- **AI Intelligence Layer**: Zero-shot Named Entity Recognition via `GLiNER` (`urchade/gliner_multi-v2.1`) to isolate entities (Person, Organization, Merchant, Bank, UPI ID, Reference) from unstructured transaction narrations, paired with local `Ollama` (`Qwen 3.5:0.8b`) for semantic header inference.
- **Relational Storage**: PostgreSQL database with SQLAlchemy 2.0 ORM, indexed for fast transaction filtering, date-range bounding, and counterparty aggregation.

### Architectural Flowchart

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
        FileRouter["/api/v1/files (Upload & Dispatch)"]
        TxRouter["/api/v1/bank-transactions (Search, Relations, Intelligence)"]
        DashRouter["/api/v1/dashboard (Dynamic KPIs)"]
        AuditRouter["/api/v1/audit-logs (Security Trails)"]
        WSRouter["/api/v1/ws (WebSocket Notifications)"]
    end

    subgraph StorageBroker ["Storage & Message Broker"]
        DiskStorage["Physical Storage (storage/cases/{case_id}/)"]
        RabbitMQ["RabbitMQ Broker (amqp://localhost:5672//)"]
    end

    subgraph WorkerEngine ["Celery Background Worker (app.tasks.process_bank_statement)"]
        Stage0["Stage 0: File Validation & Metadata Extraction"]
        Stage1["Stage 1: PDF Table Extraction / OCR Fallback / Excel-CSV Bypass"]
        Stage2["Stage 2: Raw Excel Intermediate Normalization"]
        Stage3["Stage 3 & 4: Header Detection & Concept Normalization"]
        Stage5["Stage 5: Qwen / Deterministic Header Mapping"]
        Stage6["Stage 6: Standard DataFrame Transformation"]
        Stage7["Stage 7: Transaction Validation (Dates, Amounts, Balances)"]
        Stage75["Stage 7.5: GLiNER NLP Counterparty Extraction"]
        Stage8["Stage 8: Batch Persistence & Status Update (COMPLETED)"]
    end

    subgraph Database ["PostgreSQL Relational Storage (Port 5432)"]
        DB[(PostgreSQL Database: users, cases, files, bank_transactions, audit_logs)]
    end

    UI -->|HTTPS / REST API| Gateway
    Gateway -->|Store File Stream| DiskStorage
    Gateway -->|Enqueue file_id| RabbitMQ
    RabbitMQ -->|Deliver Task| WorkerEngine
    WorkerEngine -->|Read Stored Document| DiskStorage
    WorkerEngine -->|Write Processed Transactions| DB
    Gateway -->|Query Filtered Data / KPIs| DB
    Reports -->|Fetch Data| TxRouter
    ExportEngine -->|Client Download| UI
```

---

## 2. Verified Technology Stack & Versions

All versions documented below have been physically verified directly from `backend/requirements.txt`, `backend/venv` runtime, `frontend/package.json`, and local system binaries.

### Frontend Technologies

| Package / Tool | Verified Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v24.14.1` (or `>= 18.x`) | JavaScript runtime |
| **npm** | `11.11.0` (or `>= 9.x`) | Node package manager |
| **React** | `19.2.8` | Core UI component framework |
| **React DOM** | `19.2.8` | DOM rendering for React |
| **Vite** | `8.2.2` | Lightning-fast development server & bundler |
| **Tailwind CSS** | `3.4.19` | Utility-first styling & responsive dark themes |
| **React Router DOM**| `7.18.3` | Client-side routing, protected routes, role guards |
| **Apache ECharts** | `6.1.0` | Force-directed graphs, money trails, timeline charts |
| **html2pdf.js** | `0.14.0` | Client-side PDF generation for forensic reports |
| **SweetAlert2** | `11.26.25` | Modal dialogs, operation alerts, progress bars |
| **XLSX (SheetJS)** | `0.18.5` | Client-side tabular spreadsheet generation |
| **PostCSS** | `8.5.28` | CSS transformation pipeline |
| **Autoprefixer** | `10.5.5` | Vendor prefix parsing |

### Backend Technologies

| Package / Tool | Verified Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.14.3` (compatible with `3.10`–`3.14`) | Core backend language |
| **FastAPI** | `0.141.1` | High-performance ASGI REST API framework |
| **Uvicorn** | `0.52.4` | ASGI production server |
| **SQLAlchemy** | `2.0.52` | Python SQL toolkit and Object Relational Mapper |
| **Alembic** | `1.19.2` | Database schema migrations (Head: `00d93c533932`) |
| **psycopg / psycopg-binary** | `3.3.5` | Modern PostgreSQL database adapter for Python |
| **Celery** | `5.6.3` | Distributed background task queue |
| **kombu** | `5.6.2` | AMQP messaging framework for Celery |
| **pika** | `1.4.4` | AMQP client library |
| **Pydantic** | `2.13.5` | Data validation and schema enforcement |
| **pwdlib** / **argon2-cffi** | `0.3.1` / `25.1.0` | Cryptographically secure password hashing (Argon2) |
| **python-jose** | `3.5.0` | JWT token generation, verification, and decoding |
| **python-multipart**| `0.0.32` | Multi-part form/file upload streaming |
| **pandas** | `3.0.6` | Data manipulation, column restructuring, analytics |
| **openpyxl** | `3.1.5` | Native Excel (.xlsx) workbook reader and writer |
| **pdfplumber** | `0.11.10` | PDF text and table coordinate extraction |
| **PyMuPDF (fitz)** | `1.28.2` | High-speed PDF rendering and rasterization |
| **camelot-py** | `2.0.0` | PDF table extraction library |
| **opencv-python-headless** | `5.0.0.93` | Computer vision image preprocessing for OCR |
| **pytesseract** | `0.3.13` | Optical Character Recognition wrapper for Tesseract |
| **Pillow (PIL)** | `12.3.0` | Image manipulation library |
| **gliner** | `0.2.29` | Zero-shot Named Entity Recognition model runner |
| **torch (PyTorch)**| `2.14.1` | Deep learning framework powering GLiNER |
| **transformers** | `5.16.1` | Hugging Face model architecture support |
| **python-dotenv** | `1.2.3` | Configuration loading from `.env` files |

### Infrastructure & External Services

| Service | Tested Version / Path | Requirement Level | Purpose |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `18.6` (or `>= 14.x`) | **Mandatory** | Primary relational database for all app entities |
| **RabbitMQ** | Port `5672` | **Mandatory** for background parsing | Message broker queueing bank statement processing tasks |
| **Tesseract OCR**| `C:\Program Files\Tesseract-OCR\tesseract.exe` or `PATH` | **Mandatory** for scanned PDFs | Optical character recognition fallback when standard extraction yields no text |
| **Ollama (Qwen)**| `qwen3.5:0.8b` on `http://localhost:11434` | **Optional / Fallback** | Semantic header inference for non-standard bank statements |
| **Storage Directory** | `backend/storage/cases/{case_id}/` | **Mandatory** | File system persistence for uploaded and raw Excel files |

---

## 3. Repository Directory Structure

```text
BAS/
├── README.md                           # Comprehensive project documentation (this file)
├── .gitignore                          # Repository ignore rules
├── backend/                            # FastAPI Application Root
│   ├── .env                            # Backend environment configuration (gitignored)
│   ├── alembic.ini                     # Alembic migration configuration
│   ├── requirements.txt                # Pinned Python package dependencies
│   ├── note.txt                        # Architectural pipeline reference & flow diagram
│   ├── storage/                        # Physical storage for cases and uploaded bank statements
│   │   └── cases/                      # Subfolders per case ID containing uploaded files
│   ├── venv/                           # Python virtual environment (gitignored)
│   ├── alembic/                        # Database migration scripts
│   │   ├── env.py                      # Alembic execution environment
│   │   ├── script.py.mako              # Migration generation template
│   │   └── versions/                   # 17 Migration revisions (Head: 00d93c533932)
│   └── app/                            # Backend Source Package
│       ├── __init__.py
│       ├── main.py                     # FastAPI application entry point, CORS & route registrations
│       ├── celery_app.py               # Celery app initialization, broker URL, serialization settings
│       ├── audit/                      # Audit trail module (Controller, Model, Repo, Route, Service)
│       ├── authentication/             # JWT auth endpoints (Login, Refresh, First-login password)
│       ├── bank_transactions/          # Core transaction query, search, export & financial intelligence
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
    ├── .env.production                 # Production API URL template
    └── src/                            # Frontend Application Source Code
        ├── main.jsx                    # React application bootstrapper
        ├── App.jsx                     # Root component wrapper
        ├── index.css                   # Global styles & Tailwind directives
        ├── context/                    # React Context providers
        │   ├── AuthContext.jsx         # User session, JWT tokens, login/logout state
        │   └── ThemeContext.jsx        # Global Dark/Light theme switching
        ├── routes/                     # Application routing & route guards
        │   ├── AppRoutes.jsx           # All route definitions & path mapping
        │   ├── ProtectedRoute.jsx      # Authentication guard
        │   ├── PublicRoute.jsx         # Redirection guard for logged-in users
        │   └── RoleRoute.jsx           # Role-based authorization guard
        ├── services/api/               # Modular API services
        │   ├── client.js               # Central apiRequest fetch client with JWT auto-refresh
        │   ├── auth.js                 # Authentication service
        │   ├── bankTransaction.js      # Transactions, search, graph, mode-wise, summary
        │   ├── case.js                 # Case CRUD operations
        │   ├── dashboard.js            # Dashboard dynamic statistics service
        │   ├── file.js                 # File upload & case files service
        │   └── ioMaster.js             # Investigating Officer API service
        ├── pages/                      # Page components
        │   ├── auth/                   # Login & Signup screens
        │   ├── user/                   # Investigator workspace
        │   │   ├── UserDashboard.jsx   # Primary dashboard with 5 dynamic KPI cards
        │   │   ├── cases/              # CaseList, CreateCase, CaseDetails
        │   │   ├── io_master/          # IOMasterList
        │   │   ├── analysis/           # DynamicReportDashboard (Mode Wise & Timelines)
        │   │   └── reports/            # The 5 Core Analytical Reports
        │   │       ├── CaseReportsHub.jsx                      # Catalog hub of case reports
        │   │       ├── CaseFileReport.jsx                      # Report 01: Statement & Transaction Ledger
        │   │       ├── TransactionRelationshipReport.jsx       # Report 03: Relationship & Flow Graph
        │   │       ├── CounterpartyIntelligenceReport.jsx      # Report 04: Counterparty Intelligence
        │   │       └── FinancialTransactionIntelligenceReport.jsx # Report 05: Financial Intelligence & PDF Export
        │   ├── clientAdmin/            # Organization Admin Dashboard
        │   └── superadmin/             # System SuperAdmin Dashboard
        └── components/                 # Reusable UI widgets
            ├── layout/                 # UserNavbar (Dark/Light toggle, Navigation), UserFooter
            ├── reports/                # RelationshipGraph (Apache ECharts force graph)
            └── dynamicReport/          # DynamicModeWiseChart, KpiCards, ExportControls
```

---

## 4. Prerequisites & System Requirements

Before installing the project, verify that the following system dependencies are installed on the host machine:

### 1. Operating System
- **Windows**: Windows 10 / 11 (64-bit) or Windows Server 2022.
- **Linux**: Ubuntu 22.04 LTS / 24.04 LTS, Debian 12, or RHEL 9.

### 2. Required Runtimes & Compilers
- **Python**: Version `3.14.3` (or any stable Python `>= 3.10` up to `3.14`). Confirm with `python --version`.
- **Node.js**: Version `24.14.1` (or Node `>= 18.x`). Confirm with `node --version`.
- **npm**: Version `11.11.0` (or npm `>= 9.x`). Confirm with `npm --version`.
- **PostgreSQL**: Version `18.6` (or `>= 14.x`). Confirm with `psql --version`.
- **RabbitMQ**: Version `3.12.x` or `3.13.x` with Erlang runtime.

### 3. External Binaries (OCR & AI)
- **Tesseract OCR (Mandatory for Scanned Statements)**:
  - *Windows*: Download and run the official 64-bit installer from [UB-Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki). Install to default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`.
  - *Linux*: Install via package manager:
    ```bash
    sudo apt-get update && sudo apt-get install -y tesseract-ocr libtesseract-dev tesseract-ocr-eng
    ```
- **Ollama (Optional for LLM Header Mapping)**:
  - Download and install Ollama from [ollama.ai](https://ollama.ai/).
  - Pull the lightweight model:
    ```bash
    ollama pull qwen3.5:0.8b
    ```

---

## 5. Step-by-Step Installation Guide

Follow these sequential steps on a clean environment.

### A. Clone the Repository

Clone the project from your repository hosting provider (e.g., GitHub) into your local workspace:

```bash
git clone <YOUR_REPOSITORY_URL> BAS
cd BAS
```

*(If you are working from a local extraction, ensure your active working directory is `BAS`).*

---

### B. Backend Setup (Python Virtual Environment)

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a clean Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     ```

3. Activate the virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
     *(If script execution is disabled on Windows, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once).*
   - **Linux / macOS**:
     ```bash
     source venv/bin/activate
     ```

4. Upgrade `pip` to the latest version:
   ```bash
   python -m pip install --upgrade pip setuptools wheel
   ```

5. Install the pinned Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
   > **Note on Encoding**: `requirements.txt` in this repository is encoded in UTF-16LE. Modern versions of `pip` automatically detect this encoding. If you experience an error reading requirements on older pip versions, install using `pip install --upgrade pip` first.

---

### C. Frontend Setup (React & Vite)

1. Open a separate terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install all npm dependencies:
   ```bash
   npm install
   ```
   *(Or run `npm ci` for a deterministic build based strictly on `package-lock.json`).*

3. Verify the frontend builds cleanly:
   ```bash
   npm run build
   ```
   A successful build outputs compiled assets into `frontend/dist/` without errors.

---

### D. Environment Variables Configuration

The application requires specific environment variables for backend database authentication and frontend API routing.

#### 1. Backend Environment Configuration (`backend/.env`)

Create a `.env` file inside the `backend/` directory (i.e., `backend/.env`):

```dotenv
# ============================================================
# DATABASE CONFIGURATION
# ============================================================
# Format: postgresql+psycopg://<username>:<password>@<host>:<port>/<database_name>
# Note: Reserved special characters in passwords must be URL-encoded (e.g. @ -> %40)
DATABASE_URL=postgresql+psycopg://postgres:YourSecurePassword%40123@localhost:5432/BAS

# ============================================================
# JWT SECURITY CONFIGURATION
# ============================================================
# Generate a cryptographically secure 64-character secret using:
# python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET_KEY=replace-with-a-secure-random-secret-key-of-at-least-32-chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ============================================================
# GLiNER NAMED ENTITY RECOGNITION (COUNTERPARTY INTELLIGENCE)
# ============================================================
GLINER_ENABLED=true
GLINER_MODEL_NAME=urchade/gliner_multi-v2.1
GLINER_THRESHOLD=0.20
GLINER_BATCH_SIZE=32

# ============================================================
# OLLAMA / QWEN HEADER MAPPING (OPTIONAL / FALLBACK)
# ============================================================
QWEN_MODEL=qwen3.5:0.8b
OLLAMA_BASE_URL=http://localhost:11434
QWEN_HEADER_CONFIDENCE_THRESHOLD=0.80
```

#### Environment Variables Reference Table

| Variable | Scope | Required? | Default in Code | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Backend | **Yes** | *None (raises error)* | PostgreSQL connection URI using the modern `psycopg` driver. |
| `JWT_SECRET_KEY` | Backend | **Yes** | *None (raises error)* | Symmetric secret key used to sign and verify HMAC-SHA256 JWT tokens. |
| `JWT_ALGORITHM` | Backend | Optional | `HS256` | Cryptographic algorithm for JWT tokens. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Optional | `30` | Access token lifetime in minutes before auto-refresh is triggered. |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Backend | Optional | `7` | Refresh token lifetime in days. |
| `GLINER_ENABLED` | Backend | Optional | `true` | Toggles zero-shot Named Entity Recognition for counterparties. |
| `GLINER_MODEL_NAME` | Backend | Optional | `urchade/gliner_multi-v2.1` | Hugging Face pretrained GLiNER model tag. |
| `GLINER_THRESHOLD` | Backend | Optional | `0.50` (`0.20` in .env) | Confidence threshold for entity acceptance. |
| `GLINER_BATCH_SIZE` | Backend | Optional | `32` | Batch size for GPU/CPU inference. |
| `QWEN_MODEL` | Backend | Optional | `qwen3.5:0.8b` | Model tag for Ollama fallback header mapping. |
| `OLLAMA_BASE_URL` | Backend | Optional | `http://localhost:11434`| HTTP endpoint where Ollama model server is listening. |
| `VITE_API_BASE_URL`| Frontend| **Yes** | *None (throws error)* | Base URL where the React client sends REST requests. |

#### 2. Frontend Environment Configuration (`frontend/.env.development`)

Ensure `frontend/.env.development` contains:
```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For production builds, set `frontend/.env.production`:
```dotenv
VITE_API_BASE_URL=http://localhost:8000
```
*(Or leave empty if serving frontend behind an Nginx reverse proxy on the same origin).*

---

### E. Database Setup & Alembic Migrations

1. Ensure the PostgreSQL service is active:
   - **Windows**: Check Services (`services.msc`) for `postgresql-x64-18` or run `Get-Service *postgres*`.
   - **Linux**: Run `sudo systemctl status postgresql`.

2. Create the application database and user:
   Connect to PostgreSQL via `psql`:
   ```bash
   psql -U postgres -h localhost -p 5432
   ```
   Execute the following SQL commands:
   ```sql
   CREATE DATABASE "BAS";
   -- Optional: Create a dedicated user
   -- CREATE USER bas_user WITH ENCRYPTED PASSWORD 'YourPassword123';
   -- GRANT ALL PRIVILEGES ON DATABASE "BAS" TO bas_user;
   \q
   ```

3. Apply Alembic migrations:
   From the `backend` directory (with your virtual environment active):
   ```bash
   # Check migration heads (Verified head: 00d93c533932)
   python -m alembic heads

   # Apply all migrations to the latest revision
   python -m alembic upgrade head
   ```

4. Verify database tables:
   ```bash
   psql -U postgres -d BAS -c "\dt"
   ```
   You should see all 10 core tables: `users`, `user_permissions`, `clients`, `cases`, `io_master`, `files`, `bank_transactions`, `transaction_modes`, `audit_logs`, and `statement_format_mappings`.

---

### F. RabbitMQ Message Broker Setup

RabbitMQ handles asynchronous queuing for uploaded bank statement processing tasks.

1. Ensure RabbitMQ is running:
   - **Windows**: Run `Get-Service *rabbit*` in PowerShell. If stopped, start via `Start-Service RabbitMQ`.
   - **Linux**: Run `sudo systemctl start rabbitmq-server && sudo systemctl status rabbitmq-server`.

2. Default Connection:
   The backend connects to RabbitMQ via AMQP at:
   ```text
   amqp://guest:guest@localhost:5672//
   ```
   Verify port `5672` is listening:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 5672
   ```

---

### G. OCR, NLP & LLM Model Provisioning

1. **Tesseract OCR (Windows Check)**:
   Verify Tesseract is installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`.
   ```powershell
   & "C:\Program Files\Tesseract-OCR\tesseract.exe" --version
   ```
   If installed in another directory, ensure that directory is added to your system `PATH`.

2. **GLiNER Pre-trained Models (First Run)**:
   On first execution, the Celery worker automatically downloads the `urchade/gliner_multi-v2.1` model weights (~1.4 GB) from Hugging Face into your local cache (`~/.cache/huggingface/hub/`). Ensure an active internet connection exists during initial statement processing.

3. **Ollama / Qwen (Optional)**:
   If running Ollama locally for fallback header mapping:
   ```bash
   ollama serve
   ollama pull qwen3.5:0.8b
   ```

---

## 6. How to Run the Entire System

To run the complete system in a development environment, start each service in the following exact order across separate terminal windows.

### A. Startup Sequence (Multi-Terminal)

#### Terminal 1: PostgreSQL & RabbitMQ Services
Ensure background daemon services are running:
```powershell
# Windows PowerShell (Elevated / Standard)
Start-Service *postgres*
Start-Service *rabbit*
```
*(On Linux: `sudo systemctl start postgresql && sudo systemctl start rabbitmq-server`)*

#### Terminal 2: Celery Background Worker
Open a terminal in `backend/`:
- **Windows (PowerShell)**:
  > [!IMPORTANT]
  > On Windows, Celery **must** be executed with `--pool=solo` (or `-P solo`) because Windows does not support POSIX `fork()`.
  ```powershell
  cd "c:\final bas\BAS_YASH_2_ZIP\BAS\backend"
  .\venv\Scripts\Activate.ps1
  python -m celery -A app.celery_app.celery_app worker --loglevel=INFO --pool=solo
  ```
- **Linux**:
  ```bash
  cd backend
  source venv/bin/activate
  celery -A app.celery_app.celery_app worker --loglevel=INFO
  ```
*Expected output: Celery registers `app.tasks.process_bank_statement` and connects to `amqp://guest:guest@localhost:5672//`.*

#### Terminal 3: FastAPI Backend Server
Open a terminal in `backend/`:
- **Windows (PowerShell)**:
  ```powershell
  cd "c:\final bas\BAS_YASH_2_ZIP\BAS\backend"
  .\venv\Scripts\Activate.ps1
  python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```
- **Linux**:
  ```bash
  cd backend
  source venv/bin/activate
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```
*Expected output: `Application startup complete. Uvicorn running on http://127.0.0.1:8000`.*

#### Terminal 4: React Vite Frontend Dev Server
Open a terminal in `frontend/`:
```powershell
cd "c:\final bas\BAS_YASH_2_ZIP\BAS\frontend"
npm run dev
```
*Expected output: `VITE v8.2.2 ready in XXX ms. Local: http://localhost:5173/`.*

---

### B. Verification & Health Checks

Once all terminals are running, verify each endpoint in your browser or via curl:

| Service | Target URL | Expected Response |
| :--- | :--- | :--- |
| **API Root** | `http://127.0.0.1:8000/` | `{"message": "BAS Backend is running"}` |
| **Health Check** | `http://127.0.0.1:8000/health` | `{"status": "healthy"}` |
| **Swagger UI** | `http://127.0.0.1:8000/docs` | Interactive OpenAPI documentation interface |
| **ReDoc** | `http://127.0.0.1:8000/redoc` | Alternative OpenAPI documentation interface |
| **Frontend UI** | `http://localhost:5173/` | Redirects to login page (`/login`) |

---

### C. Safe Shutdown Sequence

To terminate the running services gracefully without corrupting database transactions or queued tasks:
1. **Frontend**: Press `Ctrl + C` in Terminal 4.
2. **FastAPI**: Press `Ctrl + C` in Terminal 3.
3. **Celery Worker**: Press `Ctrl + C` in Terminal 2 (allows active statement extraction tasks to finish or acknowledge rejection).
4. **RabbitMQ / Postgres**: Stop services if no longer needed:
   ```powershell
   Stop-Service *rabbit*
   Stop-Service *postgres*
   ```

---

## 7. Core Application Features & Investigation Workflows

### A. Role-Based Access Control (RBAC)

The system enforces 4 granular user roles:
1. **`superadmin`**: Unrestricted system governance, client/tenant provisioning, global audit log oversight, and platform telemetry.
2. **`client_admin`**: Organization / agency-level administrator. Manages user accounts within their client group and inspects organization-wide case portfolios.
3. **`user`**: Primary Forensic Investigator / Analyst. Manages assigned cases, registers Investigating Officers (IOs), uploads statements, and performs analytical reporting.
4. **`admin`**: Backward-compatibility administrative role.

All protected pages are secured via `ProtectedRoute` and `RoleRoute` in `frontend/src/routes/AppRoutes.jsx`. First-time logins require a password change enforced by `FirstLoginModal.jsx`.

---

### B. Case Management & IO Master

- **Investigating Officer (IO) Master**: Central directory tracking police stations, districts, officers, ranks, and contact credentials (`/dashboard/io-master`).
- **Case Portfolio**: Investigators create case records with unique case numbers, descriptions, and assign IOs (`/dashboard/cases`).
- **Case Details & Statement Attachment**: Inside each case (`/dashboard/cases/:caseId`), multiple bank statement files across different bank accounts can be uploaded and managed simultaneously.

---

### C. The 9-Stage Document Processing Pipeline

When an investigator uploads a bank statement document, it executes through a strictly monitored 9-stage pipeline managed by `backend/app/processing/processing_service.py`:

```mermaid
flowchart TD
    A["File Uploaded (.pdf, .xlsx, .csv, .txt)"] --> B["Stage 0: Account Metadata Extractor (IFSC, AccNo, Holder)"]
    B --> C{"Format Type?"}
    C -->|PDF| D["Stage 1: PDF Table Extraction (pdfplumber / camelot)"]
    D -->|Empty or Image| E["OCR Fallback (pytesseract + OpenCV)"]
    C -->|Excel / CSV / TXT| F["Stage 1: Bypass Parser (read_csv / read_excel / txt_processor)"]
    E --> G["Stage 2: Save Intermediate Raw Excel"]
    D --> G
    F --> G
    G --> H["Stage 3: Header Row Detection (Keyword Pattern Matching)"]
    H --> I["Stage 4: Header Normalization (Whitespace, Casing, Aliases)"]
    I --> J["Stage 5: Column Mapping (Deterministic Aliases + Qwen LLM Fallback)"]
    J --> K["Stage 6: Standard DataFrame Construction"]
    K --> L["Stage 7: Transaction Validation (Dates, Signs, Balance Continuity)"]
    L --> M["Stage 7.5: GLiNER Zero-Shot Named Entity Extraction"]
    M --> N["Stage 8: PostgreSQL Batch Persistence (bank_transactions)"]
    N --> O["Status: COMPLETED (Progress: 100%)"]
```

1. **Account Metadata Extraction**: Scans document headers and stamps for Account Number, Account Holder Name, Bank Name, Branch, IFSC, MICR, Account Type, and Statement Date Range. Masks account numbers for privacy in logs.
2. **Stage 1 — Primary Extraction & OCR Fallback**:
   - Digital PDFs are extracted using `pdfplumber` and `camelot`.
   - If tables are unparsed or image-based, execution seamlessly falls back to `extract_tables_from_scanned_pdf_ocr` using Otsu binarization and `pytesseract`.
   - Spreadsheets (.xlsx, .xls) and CSVs bypass directly to DataFrame readers.
3. **Stage 2 — Raw Excel Intermediate**: Saves extracted tabular data into `storage/cases/{case_id}/{stem}_raw.xlsx` to establish an immutable checkpoint.
4. **Stage 3 — Header Detection**: Locates header coordinates by evaluating confidence against banking keywords (`date`, `narration`, `withdrawal`, `deposit`, `balance`, `chq`).
5. **Stage 4 — Header Normalization**: Removes non-alphanumeric noise, line breaks, and standardizes spacing.
6. **Stage 5 — Qwen / Deterministic Mapping**:
   - Fast deterministic mapping resolves standard aliases (`txn date` -> `transaction_date`, `dr` -> `debit`, `cr` -> `credit`, `bal` -> `balance`).
   - Any unknown headers are dynamically classified by the local Qwen LLM via Ollama.
7. **Stage 6 — Standard DataFrame**: Unifies diverse bank schemas into canonical database columns.
8. **Stage 7 — Transaction Validation**: Sanitizes date formats, coerces numeric strings to signed 2-decimal floats, validates balance integrity, and discards empty spacer rows.
9. **Stage 7.5 — GLiNER NLP Counterparty Extraction**:
   - Evaluates unstructured transaction descriptions with `urchade/gliner_multi-v2.1`.
   - Identifies: `PERSON`, `ORGANIZATION`, `MERCHANT`, `BANK`, `FINANCIAL_INSTITUTION`, `UPI_ID`, `ACCOUNT_NUMBER`.
   - Stores `counterparty_name`, `counterparty_type`, `counterparty_identifier`, `counterparty_confidence`, and `counterparty_source`.
10. **Stage 8 — Database Persistence**: Performs batch insertion into `bank_transactions` table, links records to `case_id` and `file_id`, and marks the file status as `COMPLETED` (100%).

---

### D. The 5 Core Forensic Intelligence Reports

BAS delivers five specialized investigation reports accessible through the Case Reports Hub (`/dashboard/cases/:caseId/reports`):

#### 1. Bank Statement & Transaction Report (`CaseFileReport.jsx`)
- **Route**: `/dashboard/cases/:caseId/reports/file-statement`
- **Features**:
  - Compact case and statement file multi-select checkbox dropdown.
  - Dual presentation modes: **Filtered Transactions Ledger (Grid View)** and **Graph View**.
  - Advanced filtering: Transaction Date ranges, Minimum/Maximum Amount, Transaction Mode (UPI, NEFT, RTGS, CASH, CHEQUE), Debit/Credit, Keyword search, and Narration exclusion.
  - **Full-Dataset Export CSV**: Exports all filtered transactions across all pagination pages with RFC 4180 compliance, quotation escaping, UTF-8 BOM (`\uFEFF`) for Microsoft Excel compatibility, and counterparty fields (`Counter Party`, `Counterparty Type`, `Counterparty Source`).

#### 2. Transaction Mode Wise Report (`DynamicReportDashboard.jsx`)
- **Route**: `/analysis` or `/dashboard/cases/:caseId/reports/timeline`
- **Features**:
  - Volume and value breakdowns grouped by transaction channel (UPI, NEFT, RTGS, IMPS, Cash, Cheque, NetBanking).
  - Mode-specific filtering and interactive bar/donut distributions powered by Apache ECharts.

#### 3. Transaction Relationship / Flow Report (`TransactionRelationshipReport.jsx`)
- **Route**: `/dashboard/cases/:caseId/reports/transaction-relationships`
- **Features**:
  - Interactive force-directed network money trail graph rendered with Apache ECharts.
  - Visual nodes represent the primary account holder and all transacting counterparties.
  - Directed edges depict flow direction (Debit vs Credit) with stroke width proportional to transaction volume.
  - Multi-file aggregation: Trace cross-account fund movements within a multi-bank investigation.

#### 4. Counterparty Intelligence Report (`CounterpartyIntelligenceReport.jsx`)
- **Route**: `/dashboard/cases/:caseId/reports/counterparty-intelligence`
- **Features**:
  - Aggregated ledger of all unique counterparties extracted by the GLiNER NLP engine.
  - Entity classification tags: Person, Merchant, Financial Institution, Organization, or UPI Handle.
  - Frequency analysis: Identifies top transactors by transaction count and aggregate monetary volume.
  - Drill-down drawer: Clicking any counterparty exposes their complete transaction history across the case.

#### 5. Financial Transaction Intelligence Report (`FinancialTransactionIntelligenceReport.jsx`)
- **Route**: `/dashboard/cases/:caseId/reports/financial-transaction-intelligence`
- **Features**:
  - Executive financial summary: Net turnover, average/median transaction size, credit-to-debit ratio.
  - Forensic Anomaly Detection:
    - **Outliers**: Statistical anomaly detection via Interquartile Range ($Q_3 + 1.5 \times \text{IQR}$).
    - **Round-Amount Structuring**: Identifies round-sum clusters (multiples of ₹1,000, ₹10,000, ₹50,000) indicative of cash structuring, smurfing, or hawala channels.
    - **Balance Velocity & Spikes**: Daily high-activity dates and balance trend trajectories.
  - **Direct PDF Export**: Clicking **Export PDF** generates a formatted forensic report directly via `html2pdf.js` with progress modals, downloading automatically without opening browser print dialogs.

---

## 8. Comprehensive API Endpoints Reference

All endpoints are registered on the FastAPI backend with the `/api/v1` namespace. Authentication requires an `Authorization: Bearer <access_token>` header unless marked Public.

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Purpose | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Public | Create new user account | `UserCreateRequest` (username, email, password, role) |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & receive tokens | `UserLoginRequest` (username, password) |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh expired access token | `{"refresh_token": "..."}` |
| `POST` | `/api/v1/auth/first-login-password` | Bearer | Set password on initial login | `FirstLoginPasswordRequest` (current, new password) |
| `POST` | `/api/v1/auth/dismiss-first-login` | Bearer | Dismiss first-login banner | None |

### Dashboard & Telemetry (`/api/v1/dashboard`)

| Method | Endpoint | Auth | Purpose | Query Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/statistics` | Bearer | Dynamic KPI metrics for dashboard cards | Role-scoped automatically (Cases, IOs, Files, Txns) |

### Case Management (`/api/v1/cases`)

| Method | Endpoint | Auth | Purpose | Query / Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/cases/` | Bearer | Create a new case file | `CaseCreateRequest` (case_number, case_title, io_id) |
| `GET` | `/api/v1/cases/` | Bearer | List cases accessible to user | Pagination, status |
| `GET` | `/api/v1/cases/{case_id}` | Bearer | Retrieve specific case details | `case_id` path param |
| `PUT` | `/api/v1/cases/{case_id}` | Bearer | Update case metadata | `CaseUpdateRequest` |
| `DELETE`| `/api/v1/cases/{case_id}` | Bearer | Delete case record | `case_id` path param |

### Investigating Officer Master (`/api/v1/io-master`)

| Method | Endpoint | Auth | Purpose | Query / Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/io-master/` | Bearer | Register an Investigating Officer | `IOMasterCreateRequest` (name, designation, station) |
| `GET` | `/api/v1/io-master/` | Bearer | List all registered IOs | Search query, pagination |
| `GET` | `/api/v1/io-master/{io_id}` | Bearer | Retrieve specific IO profile | `io_id` path param |
| `PUT` | `/api/v1/io-master/{io_id}` | Bearer | Update IO details | `IOMasterUpdateRequest` |
| `DELETE`| `/api/v1/io-master/{io_id}` | Bearer | Remove IO record | `io_id` path param |

### File & Statement Management (`/api/v1/files`)

| Method | Endpoint | Auth | Purpose | Query / Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/files/{case_id}/upload` | Bearer | Upload statement & trigger Celery | `multipart/form-data` (`file`) |
| `GET` | `/api/v1/files/case/{case_id}` | Bearer | List all statement files for a case | `case_id` path param |
| `GET` | `/api/v1/files/{file_id}/view` | Bearer | View file metadata & processing stage | `file_id` path param |
| `PATCH`| `/api/v1/files/{file_id}` | Bearer | Update account metadata manually | `FileUpdateRequest` |
| `DELETE`| `/api/v1/files/{file_id}` | Bearer | Delete uploaded file & transactions | `file_id` path param |

### Bank Transactions & Forensic Intelligence (`/api/v1/bank-transactions`)

| Method | Endpoint | Auth | Purpose | Important Query Parameters |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/search` | Bearer | Paginated search & multi-field filter | `file_ids`, `search`, `date_from`, `date_to`, `transaction_type`, `min_amount`, `max_amount`, `mode`, `has_cheque_only`, `page`, `page_size` |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/summary` | Bearer | Aggregate metrics (debit, credit, counts) | `case_id`, `file_ids`, `mode` |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/mode-wise` | Bearer | Transaction volume by channel | `case_id`, `file_ids` |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/transaction-relationships` | Bearer | Node-link graph for money trail | `file_ids` (comma-separated), `min_amount`, `start_date`, `end_date` |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/counterparty-analysis` | Bearer | Grouped counterparties & volume | `file_ids` (comma-separated) |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/financial-analysis` | Bearer | Statistical forensics, outliers, round-sums | `file_ids`, `date_from`, `date_to`, `transaction_type`, `min_amount`, `max_amount` |
| `GET` | `/api/v1/bank-transactions/case/{case_id}/export` | Bearer | Server-side CSV streaming export | Filter params + `file_ids` |
| `GET` | `/api/v1/bank-transactions/transaction-modes` | Bearer | List canonical payment channels | None |

### Multi-Tenant Clients (`/api/v1/clients`) & Users (`/api/v1/users`)

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/clients` | SuperAdmin | Register new tenant / client organization |
| `GET` | `/api/v1/clients` | SuperAdmin | List registered organizations |
| `GET` | `/api/v1/users` | Admin / SuperAdmin | List users with filtering by status/client |
| `POST` | `/api/v1/users` | Admin / SuperAdmin | Create user in client organization |
| `PUT` | `/api/v1/users/{user_id}/permissions` | Admin | Update user granular permissions |

### System & Real-Time

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Service liveness probe returning `{"status": "healthy"}` |
| `GET` | `/` | Public | Gateway ping probe |
| `WS` | `/api/v1/ws/admin-dashboard` | Public/Bearer | WebSocket broadcast channel for live processing progress |

---

## 9. Troubleshooting & Diagnostics Guide

| Symptom / Error | Likely Root Cause | Diagnostic Command / Check | Safe Resolution Steps |
| :--- | :--- | :--- | :--- |
| `ImportError: DLL load failed while importing encodingdb: An Application Control policy has blocked this file` | Windows Defender Application Control (WDAC) or AppLocker blocked native `.pyd` libraries in Camelot/Playa. | Run in venv: `python -c "import camelot"` | 1. If using Windows with AppLocker, unblock files via PowerShell: `Get-ChildItem -Path .\backend\venv -Recurse \| Unblock-File`.<br>2. Alternatively, run using Linux/WSL2 where WDAC policies do not restrict python shared objects. |
| `DATABASE_URL is not configured` | Missing or misnamed `.env` file in `backend/` directory. | Check `Test-Path .\backend\.env` | Ensure `.env` is situated directly in `backend/` and defines `DATABASE_URL=postgresql+psycopg://...`. |
| `connection to server at "localhost", port 5432 failed: Connection refused` | PostgreSQL Windows Service is not running or port 5432 is blocked. | Run `Get-Service *postgres*` or `Test-NetConnection -Port 5432 localhost` | Start the PostgreSQL service via `Start-Service postgresql*` or through Windows `services.msc`. |
| `password authentication failed for user "postgres"` | Incorrect username or password in `DATABASE_URL`, or password contains unescaped special characters. | Connect via CLI: `psql -U postgres -h localhost` | URL-encode special characters in `DATABASE_URL` (e.g., `@` becomes `%40`, `#` becomes `%23`). |
| `[API Network Error] Request to http://127.0.0.1:8000/... failed` | FastAPI backend is not running, or crashed during startup. | Check backend terminal or run `curl http://127.0.0.1:8000/health` | Start Uvicorn in `backend/` via `python -m uvicorn app.main:app --reload --port 8000`. |
| `VITE_API_BASE_URL is not configured` | Missing `.env.development` or `.env.production` in `frontend/`. | Check `frontend/.env.development` | Create `frontend/.env.development` with `VITE_API_BASE_URL=http://127.0.0.1:8000` and restart Vite dev server. |
| Celery tasks stuck in `QUEUED` status; never transition to `PROCESSING` | RabbitMQ broker is down, or Celery worker process is not active. | Check RabbitMQ service (`Get-Service *rabbit*`) and check Celery terminal | 1. Start RabbitMQ: `Start-Service RabbitMQ`.<br>2. Start worker: `python -m celery -A app.celery_app.celery_app worker --loglevel=INFO -P solo`. |
| Celery throws `ValueError: not enough values to unpack` on Windows | Celery worker was launched with default prefork pool on Windows. | Check Celery terminal command | Always append `--pool=solo` (or `-P solo`) when launching Celery on Windows OS. |
| `tesseract is not installed or it's not in your PATH` | Tesseract OCR binary missing during scanned PDF processing. | Run `where.exe tesseract` in PowerShell | Install UB-Mannheim Tesseract OCR to `C:\Program Files\Tesseract-OCR\` and add this path to your System Environment `PATH`. |
| `Failed to load GLiNER model 'urchade/gliner_multi-v2.1'` | No internet connection on first run, or Hugging Face Hub timed out. | Check Celery terminal output | Ensure internet connectivity is active during first model download. If offline, copy cached weights into `~/.cache/huggingface/hub/`. |
| `404 Not Found` on API requests from Frontend | Route prefix mismatch (e.g. omitting `/api/v1/`). | Inspect browser network tab | All API endpoints require the `/api/v1` prefix (e.g., `/api/v1/dashboard/statistics`). |
| `CORS error: No 'Access-Control-Allow-Origin' header` | Frontend is running on a port not listed in `backend/app/main.py`. | Check frontend port in browser URL | `main.py` explicitly allows `5173`, `5174`, `3000`, and regex matching `localhost:[0-9]+`. Verify frontend origin matches `localhost` or `127.0.0.1`. |

---

## 10. Testing, Linting & Verification

### A. Frontend Verification
1. **Production Build Validation**:
   ```powershell
   cd frontend
   npm run build
   ```
   Ensures all JSX syntax, CSS directives, and module imports bundle cleanly without errors.
2. **ESLint Linting**:
   ```powershell
   npm run lint
   ```

### B. Backend Verification
1. **Module Compilation & Syntax Validation**:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m compileall app
   ```
2. **Import Verification**:
   ```powershell
   .\venv\Scripts\python.exe -c "import app.main; print('FastAPI App and Routers Loaded Successfully')"
   .\venv\Scripts\python.exe -c "import app.celery_app; print('Celery Configuration Loaded Successfully')"
   ```
3. **Database Migration State Check**:
   ```powershell
   .\venv\Scripts\python.exe -m alembic current
   ```

---

## 11. Production Deployment & Operational Considerations

When preparing BAS for an enterprise forensic or law enforcement production deployment:

### 1. Reverse Proxy & SSL Termination (Nginx)
Deploy Nginx in front of Uvicorn and Vite static assets. Configure Nginx to:
- Terminate TLS/SSL (HTTPS on port 443).
- Route `/api/` and `/ws/` requests to Uvicorn upstream on `127.0.0.1:8000`.
- Serve compiled frontend static files from `frontend/dist/`.
- Set client maximum body size to `100M` (`client_max_body_size 100M;`) to accommodate large high-resolution PDF statements.

### 2. Multi-Worker ASGI Production Runner
In production Linux environments, run Uvicorn behind Gunicorn with multiple worker processes:
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 --timeout 120
```

### 3. Celery Daemonization (Systemd / Supervisor)
Run Celery as a managed `systemd` service with automatic restarts on crash:
```ini
[Unit]
Description=BAS Celery Worker
After=network.target rabbitmq-server.service

[Service]
Type=simple
User=bas_user
WorkingDirectory=/opt/bas/backend
ExecStart=/opt/bas/backend/venv/bin/celery -A app.celery_app.celery_app worker --loglevel=INFO --concurrency=4
Restart=always

[Install]
WantedBy=multi-user.target
```

### 4. Storage Persistence & Backups
- **Persistent Storage**: Ensure `backend/storage/cases/` is backed by redundant storage (e.g., RAID 10 or AWS EBS) with daily snapshots.
- **PostgreSQL Backups**: Schedule automated daily logical dumps via `pg_dump`:
  ```bash
  pg_dump -U postgres -Fc BAS > /backup/bas_db_$(date +%Y%m%d).dump
  ```
- **Secret Rotation**: Never use default secrets. Generate a high-entropy `JWT_SECRET_KEY` and restrict file permissions on `backend/.env` (`chmod 600 backend/.env`).

---

*Bank Analysis System (BAS) — Forensic Document Intelligence & Financial Analytics Platform.*