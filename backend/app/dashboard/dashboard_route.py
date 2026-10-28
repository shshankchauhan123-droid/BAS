from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.user.user_model import User
from app.case.case_model import Case
from app.io_master.io_master_model import IOMaster
from app.files.file_model import File
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.ncrp.ncrp_model import NcrpFile, NcrpTransaction
from app.dashboard.dashboard_schema import DashboardStatisticsResponse

router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)

@router.get("/statistics", response_model=DashboardStatisticsResponse)
def get_dashboard_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_role = str(current_user.role).lower()
    
    # Cases
    case_query = db.query(Case)
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            case_query = case_query.filter(Case.client_id == current_user.client_id)
        else:
            case_query = case_query.filter(
                or_(
                    Case.created_by == current_user.id,
                    Case.assigned_to == current_user.id
                )
            )
    analysis_cases_count = case_query.count()
    
    # IO Master
    io_query = db.query(IOMaster)
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            io_query = io_query.join(User, IOMaster.created_by == User.id).filter(User.client_id == current_user.client_id)
        else:
            io_query = io_query.filter(IOMaster.created_by == current_user.id)
    investigating_officers_count = io_query.count()
    
    # Bank Statements (Files)
    file_query = db.query(File)
    if hasattr(File, "document_type"):
        file_query = file_query.filter(File.document_type == "BANK_STATEMENT")
    file_query = file_query.filter(File.is_superseded == False)
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            file_query = file_query.join(Case, File.case_id == Case.id).filter(Case.client_id == current_user.client_id)
        else:
            file_query = file_query.join(Case, File.case_id == Case.id).filter(
                or_(
                    Case.created_by == current_user.id,
                    Case.assigned_to == current_user.id
                )
            )
    bank_statements_count = file_query.count()
    
    # Transactions (Bank Transactions)
    txn_query = db.query(BankTransaction).join(File, BankTransaction.file_id == File.id)
    if hasattr(File, "document_type"):
        txn_query = txn_query.filter(File.document_type == "BANK_STATEMENT")
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            txn_query = txn_query.join(Case, File.case_id == Case.id).filter(Case.client_id == current_user.client_id)
        else:
            txn_query = txn_query.join(Case, File.case_id == Case.id).filter(
                or_(
                    Case.created_by == current_user.id,
                    Case.assigned_to == current_user.id
                )
            )
    transactions_count = txn_query.count()

    # NCRP Statements (Workbooks)
    ncrp_file_query = db.query(func.count(NcrpFile.id)).filter(NcrpFile.status != "FAILED")
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            ncrp_file_query = ncrp_file_query.join(Case, NcrpFile.case_id == Case.id).filter(
                Case.client_id == current_user.client_id
            )
        else:
            ncrp_file_query = ncrp_file_query.join(Case, NcrpFile.case_id == Case.id).filter(
                or_(
                    Case.created_by == current_user.id,
                    Case.assigned_to == current_user.id
                )
            )
    ncrp_statements_count = ncrp_file_query.scalar() or 0

    # NCRP Transactions (Imported records)
    ncrp_txn_query = (
        db.query(func.count(NcrpTransaction.id))
        .join(NcrpFile, NcrpTransaction.ncrp_file_id == NcrpFile.id)
        .filter(NcrpFile.status != "FAILED")
    )
    if user_role not in ["superadmin", "admin"]:
        if user_role == "client_admin":
            ncrp_txn_query = ncrp_txn_query.join(Case, NcrpFile.case_id == Case.id).filter(
                Case.client_id == current_user.client_id
            )
        else:
            ncrp_txn_query = ncrp_txn_query.join(Case, NcrpFile.case_id == Case.id).filter(
                or_(
                    Case.created_by == current_user.id,
                    Case.assigned_to == current_user.id
                )
            )
    ncrp_transactions_count = ncrp_txn_query.scalar() or 0
    
    # Analytical Reports
    # Since reports are not persisted in the database, we return 0 as requested by the constraints.
    analytical_reports_count = 0
    
    return {
        "analysis_cases": analysis_cases_count,
        "investigating_officers": investigating_officers_count,
        "bank_statements": bank_statements_count,
        "transactions": transactions_count,
        "ncrp_statements": ncrp_statements_count,
        "ncrp_statement_count": ncrp_statements_count,
        "ncrp_transactions": ncrp_transactions_count,
        "ncrp_transaction_count": ncrp_transactions_count,
        "analytical_reports": analytical_reports_count
    }
