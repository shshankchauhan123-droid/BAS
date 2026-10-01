import pandas as pd
from sqlalchemy.orm import Session
from app.bank_transactions.bank_transaction_model import BankTransaction
from app.processing.persistence.transaction_repository import (
    delete_transactions_by_file_id,
    bulk_insert_transactions,
)
from app.bank_transactions.transaction_mode_service import get_all_modes, detect_transaction_mode

def persist_transactions(
    db: Session,
    validated_df: pd.DataFrame,
    file_id: int,
    case_id: int,
):
    """
    Persist valid transactions from the DataFrame into the database.
    This function should be called within an active transaction block.
    """
    input_rows = len(validated_df)
    
    # Filter only valid rows
    if "_is_valid" in validated_df.columns:
        valid_df = validated_df[validated_df["_is_valid"] == True]
    else:
        valid_df = validated_df
        
    valid_rows = len(valid_df)
    invalid_rows = input_rows - valid_rows
    
    print("============================================================")
    print("STAGE 8 - DATABASE PERSISTENCE")
    print("============================================================")
    print(f"\nINPUT ROWS:\n{input_rows}")
    print(f"\nVALID TRANSACTIONS:\n{valid_rows}")
    print(f"\nINVALID TRANSACTIONS:\n{invalid_rows}")
    print(f"\nROWS TO INSERT:\n{valid_rows}")
    print("\nTARGET TABLE:\nbank_transactions")
    print(f"\nFILE ID:\n{file_id}")
    print(f"\nCASE ID:\n{case_id}")
    print("\nINSERTING TRANSACTIONS...")
    
    # Delete existing transactions for this file (Idempotency)
    delete_transactions_by_file_id(db, file_id)
    
    # Map dataframe to model objects
    transactions = []
    
    # Replace pd.NA, np.nan, and math.nan with None for safe SQLAlchemy insertion
    valid_df = valid_df.replace({pd.NA: None, float("nan"): None})
    
    # Ensure dates are parsed correctly
    valid_df["transaction_date"] = pd.to_datetime(valid_df["transaction_date"], dayfirst=True, errors="coerce").dt.date
    valid_df = valid_df.replace({pd.NaT: None})
    
    # Fetch file record to retrieve account metadata
    from app.files.file_repository import get_file_by_id
    file_record = get_file_by_id(db, file_id)
    account_name = file_record.account_name if file_record else None
    account_number = file_record.account_number if file_record else None
    # Fetch available transaction modes
    available_modes = get_all_modes(db)
    
    for _, row in valid_df.iterrows():
        # Handle the case where pandas replace might leave some np.nan behind
        def clean_val(v):
            if pd.isna(v):
                return None
            return v

        current_mode = clean_val(row.get("mode"))
        description_val = clean_val(row.get("description"))
        
        final_mode = current_mode
        if not final_mode and description_val:
            final_mode = detect_transaction_mode(description_val, available_modes)

        transaction = BankTransaction(
            file_id=file_id,
            case_id=case_id,
            account_name=clean_val(row.get("account_name")) or account_name,
            account_number=clean_val(row.get("account_number")) or account_number,
            transaction_date=clean_val(row.get("transaction_date")),
            description=description_val,
            cheque_number=clean_val(row.get("cheque_number")),
            debit=clean_val(row.get("debit")),
            credit=clean_val(row.get("credit")),
            balance=clean_val(row.get("balance")),
            mode=final_mode,
        )
        transactions.append(transaction)
        
    if transactions:
        bulk_insert_transactions(db, transactions)
        
    print(f"\nTRANSACTIONS INSERTED:\n{len(transactions)}")
    
    return len(transactions)
