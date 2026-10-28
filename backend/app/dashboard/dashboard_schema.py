from pydantic import BaseModel


class DashboardStatisticsResponse(BaseModel):
    analysis_cases: int = 0
    investigating_officers: int = 0
    bank_statements: int = 0
    transactions: int = 0
    ncrp_statements: int = 0
    ncrp_statement_count: int = 0
    ncrp_transactions: int = 0
    ncrp_transaction_count: int = 0
    analytical_reports: int = 0
