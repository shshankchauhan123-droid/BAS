from sqlalchemy.orm import Session

from app.bank_transactions.bank_transaction_model import (
    BankTransaction as BankTransactionModel,
)
from app.bank_transactions.bank_transaction_repository import (
    create_transactions,
)
from app.processing.schemas.bank_statement import (
    BankTransaction as ParsedBankTransaction,
)


def save_parsed_transactions(
    db: Session,
    parsed_transactions: list[ParsedBankTransaction],
    file_id: int,
    case_id: int,
) -> list[BankTransactionModel]:

    if not parsed_transactions:
        return []

    transactions = []

    for parsed in parsed_transactions:

        transaction = BankTransactionModel(
            file_id=file_id,
            case_id=case_id,

            transaction_date=parsed.transaction_date,
            description=parsed.description,

            debit=parsed.debit,
            credit=parsed.credit,
            balance=parsed.balance,

            cheque_number=parsed.cheque_number,
            reference_number=parsed.reference_number,
            alpha=parsed.alpha,

            source_page=parsed.source_page,
            source_row=parsed.source_row,

            extraction_confidence=parsed.extraction_confidence,

            raw_narration=parsed.raw_narration,
            raw_row=parsed.raw_row,
        )

        transactions.append(transaction)

    return create_transactions(
        db=db,
        transactions=transactions,
    )