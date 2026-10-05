import pathlib
import re

file_path = pathlib.Path(r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\validation\transaction_validator.py')
content = file_path.read_text(encoding='utf-8')

old_log_block = '''    valid_count = vdf["_is_valid"].sum()
    invalid_count = len(vdf) - valid_count
    
    print("VALIDATION RESULT:")
    print(f"Valid rows: {valid_count}")
    print(f"Invalid rows: {invalid_count}\\n")
    
    # Format output correctly
    final_columns = [
        "transaction_date",
        "description",
        "cheque_number",
        "debit",
        "credit",
        "balance",
        "mode",
        "_is_valid",
        "_validation_errors"
    ]
    
    # Reorder
    vdf = vdf[final_columns]
    
    import json
    print("FINAL COLUMNS:")
    print(json.dumps(final_columns, indent=4))
    print()
    print("STAGE 7 VALIDATION COMPLETED")
    print("============================================================")
    
    return vdf'''

new_log_block = '''    valid_count = vdf["_is_valid"].sum()
    invalid_count = len(vdf) - valid_count
    
    # Tally up all validation errors
    from collections import Counter
    error_tally = Counter()
    invalid_rows_sample = []
    
    for idx, row in vdf.iterrows():
        if not row["_is_valid"]:
            for err in row["_validation_errors"]:
                error_tally[err] += 1
            if len(invalid_rows_sample) < 10:
                invalid_rows_sample.append(row)
    
    print("============================================================")
    print("STAGE 7 VALIDATION SUMMARY")
    print("============================================================")
    print(f"\\nInput rows: {len(vdf)}")
    print(f"Valid rows: {valid_count}")
    print(f"Invalid rows: {invalid_count}\\n")
    
    print("Validation errors:")
    if not error_tally:
        print("  None")
    else:
        for err, count in error_tally.most_common():
            print(f"  {err}: {count}")
    print()
    
    if invalid_rows_sample:
        print("Sample invalid rows (max 10):")
        for r in invalid_rows_sample:
            print(f"  row={r.name}")
            print(f"    date={r.get('transaction_date')}")
            print(f"    description={r.get('description')}")
            print(f"    debit={r.get('debit')}")
            print(f"    credit={r.get('credit')}")
            print(f"    balance={r.get('balance')}")
            print(f"    errors={r.get('_validation_errors')}")
            print("")
    
    # Format output correctly
    final_columns = [
        "transaction_date",
        "description",
        "cheque_number",
        "debit",
        "credit",
        "balance",
        "mode",
        "_is_valid",
        "_validation_errors"
    ]
    
    # Reorder
    vdf = vdf[final_columns]
    
    print("STAGE 7 VALIDATION COMPLETED")
    print("============================================================")
    
    return vdf'''

if old_log_block in content:
    content = content.replace(old_log_block, new_log_block)
    file_path.write_text(content, encoding='utf-8')
    print("Patched logging in transaction_validator.py")
else:
    print("Could not find old log block")
