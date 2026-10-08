import os

filepath_repo = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\bank_transactions\bank_transaction_repository.py'
with open(filepath_repo, 'a', encoding='utf-8') as f:
    f.write('''

def get_counterparty_analysis(db: Session, case_id: int, file_ids: list[int]):
    from sqlalchemy import func
    from app.files.file_model import File
    
    # Check valid files
    files = db.query(File).filter(File.id.in_(file_ids), File.case_id == case_id).all()
    if not files:
        return {"error": "No valid files"}
        
    valid_file_ids = [f.id for f in files]
    file_map = {f.id: f.original_filename for f in files}
    
    # Query grouped by counterparty AND file_id
    query = db.query(
        BankTransaction.counterparty_name,
        BankTransaction.counterparty_type,
        BankTransaction.file_id,
        func.count(BankTransaction.id).label("transaction_count"),
        func.sum(BankTransaction.debit).label("total_debit"),
        func.sum(BankTransaction.credit).label("total_credit"),
        func.min(BankTransaction.transaction_date).label("first_transaction"),
        func.max(BankTransaction.transaction_date).label("last_transaction")
    ).filter(
        BankTransaction.case_id == case_id,
        BankTransaction.file_id.in_(valid_file_ids),
        BankTransaction.counterparty_name.isnot(None),
        BankTransaction.counterparty_name != "",
        BankTransaction.counterparty_status != "NOT_FOUND"
    ).group_by(
        BankTransaction.counterparty_name,
        BankTransaction.counterparty_type,
        BankTransaction.file_id
    )
    
    results = query.all()
    
    # Process results in python to build the common counterparty structure
    cp_map = {}
    
    for row in results:
        cp_name = row.counterparty_name.strip()
        cp_name_upper = cp_name.upper()
        # Normalization
        if cp_name_upper not in cp_map:
            cp_map[cp_name_upper] = {
                "counterparty_name": cp_name,
                "counterparty_type": row.counterparty_type,
                "files": {},
                "total_transactions": 0,
                "total_debit": 0.0,
                "total_credit": 0.0,
                "first_transaction": row.first_transaction,
                "last_transaction": row.last_transaction
            }
            
        cp = cp_map[cp_name_upper]
        
        dr = float(row.total_debit or 0.0)
        cr = float(row.total_credit or 0.0)
        
        cp["files"][row.file_id] = {
            "file_id": row.file_id,
            "file_name": file_map.get(row.file_id, str(row.file_id)),
            "transaction_count": row.transaction_count,
            "total_debit": dr,
            "total_credit": cr
        }
        
        cp["total_transactions"] += row.transaction_count
        cp["total_debit"] += dr
        cp["total_credit"] += cr
        
        if row.first_transaction:
            if not cp["first_transaction"] or row.first_transaction < cp["first_transaction"]:
                cp["first_transaction"] = row.first_transaction
                
        if row.last_transaction:
            if not cp["last_transaction"] or row.last_transaction > cp["last_transaction"]:
                cp["last_transaction"] = row.last_transaction

    
    final_counterparties = []
    
    # Build array
    for key, data in cp_map.items():
        data["file_count"] = len(data["files"])
        data["total_value"] = data["total_debit"] + data["total_credit"]
        data["file_ids"] = list(data["files"].keys())
        data["files_list"] = list(data["files"].values())
        final_counterparties.append(data)
        
    final_counterparties.sort(key=lambda x: x["total_transactions"], reverse=True)
    
    summary = {
        "selected_statements": len(valid_file_ids),
        "unique_counterparties": len(final_counterparties),
        "common_counterparties": sum(1 for c in final_counterparties if c["file_count"] >= 2),
        "common_to_all": sum(1 for c in final_counterparties if c["file_count"] == len(valid_file_ids)),
        "total_transactions": sum(c["total_transactions"] for c in final_counterparties),
        "total_debit": sum(c["total_debit"] for c in final_counterparties),
        "total_credit": sum(c["total_credit"] for c in final_counterparties),
    }
    
    summary["total_value"] = summary["total_debit"] + summary["total_credit"]
    
    return {
        "case_id": case_id,
        "file_ids": valid_file_ids,
        "files_meta": [{"id": k, "name": v} for k, v in file_map.items()],
        "mode": "multiple" if len(valid_file_ids) > 1 else "single",
        "summary": summary,
        "counterparties": final_counterparties
    }
''')
print("Added get_counterparty_analysis to repository")
