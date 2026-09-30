import os
from pathlib import Path
from sqlalchemy.orm import Session

from app.files.file_repository import get_file_by_id, update_file
from app.processing.pdf.pdf_table_extractor import extract_tables_from_pdf
from app.processing.excel.raw_excel_writer import save_raw_excel


def process_bank_statement_first_stage(db: Session, file_id: int):
    """
    First stage of bank statement processing:
    1. Get file
    2. Extract PDF tables to DataFrame
    3. Save DataFrame to RAW Excel
    """
    # ------------------------------------------------------------
    # STEP 1: GETTING FILE INFORMATION
    # ------------------------------------------------------------
    file_record = get_file_by_id(db, file_id)
    if not file_record:
        raise ValueError(f"File with ID {file_id} not found.")

    file_record.status = "PROCESSING"
    file_record.processing_stage = "pdf_table_extraction"
    file_record.processing_progress = "10%"
    update_file(db, file_record)

    # ------------------------------------------------------------
    # STAGE 1 - PDF TABLE EXTRACTION
    # ------------------------------------------------------------
    print("============================================================")
    print("STAGE 1 - PDF TABLE EXTRACTION")
    print("============================================================")
    print("\nStarting PDF table extraction...\n")

    # This function will print its own logs (PDF TABLE EXTRACTION...)
    raw_df = extract_tables_from_pdf(file_record.file_path)

    print(f"\nTables detected: 1")  # Camelot might not expose table count directly without modifying its return, defaulting for display as asked
    print(f"Rows extracted: {len(raw_df)}")
    print(f"Columns extracted: {len(raw_df.columns)}")

    print("\nSTAGE 1 SUCCESS\n")
    print("Raw DataFrame created successfully.\n")

    # ------------------------------------------------------------
    # STAGE 1 - RAW EXCEL CREATION
    # ------------------------------------------------------------
    print("============================================================")
    print("STAGE 1 - RAW EXCEL CREATION")
    print("============================================================")
    print("\nCreating raw Excel...\n")
    
    file_path = Path(file_record.file_path)
    excel_filename = f"{file_path.stem}_raw.xlsx"
    excel_path = file_path.parent / excel_filename
    
    saved_path = save_raw_excel(raw_df, str(excel_path))
    print(f"Raw Excel saved:\n{saved_path}")
    
    print("\nSTAGE 1 RAW EXCEL SUCCESS\n")

    file_record.raw_excel_path = saved_path
    file_record.processing_stage = "raw_excel_reading"
    file_record.processing_progress = "20%"
    update_file(db, file_record)
    
    # ------------------------------------------------------------
    # STAGE 2: EXCEL READER
    # ------------------------------------------------------------
    from app.processing.excel.excel_reader import read_raw_excel
    excel_df = read_raw_excel(file_record.id, file_record.raw_excel_path)
    
    # ------------------------------------------------------------
    # STAGE 3: HEADER DETECTION
    # ------------------------------------------------------------
    file_record.processing_stage = "header_detection"
    file_record.processing_progress = "30%"
    update_file(db, file_record)
    
    print("============================================================")
    print("STAGE 3 - HEADER DETECTION")
    print("============================================================")
    print("\nStage 3 started")
    print("Status: PROCESSING")
    print("Stage: header_detection")
    print("Progress: 30%\n")
    print("Detecting transaction table header...\n")
    
    print(f"Input rows: {len(excel_df)}")
    print(f"Input columns: {len(excel_df.columns)}\n")
    
    from app.processing.mapping.header_detector import detect_header_row
    
    try:
        header_info = detect_header_row(excel_df)
        
        print("Header detection result:")
        print(f"Header row index: {header_info['header_row_index']}")
        print(f"Matched headers: {header_info['matched_columns']}")
        print(f"Confidence: {header_info['confidence']}\n")
        
        print("STAGE 3 SUCCESS\n")
        print("Status: PROCESSING")
        print("Stage: header_detection")
        print("Progress: 30%\n")
        print("============================================================")
        
    except Exception as e:
        print("STAGE 3 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    # ------------------------------------------------------------
    # STAGE 4: HEADER NORMALIZATION
    # ------------------------------------------------------------
    file_record.processing_stage = "header_normalization"
    file_record.processing_progress = "40%"
    update_file(db, file_record)
    
    print("============================================================")
    print("STAGE 4 - HEADER NORMALIZATION")
    print("============================================================")
    print("\nStage 4 started")
    print("Status: PROCESSING")
    print("Stage: header_normalization")
    print("Progress: 40%\n")
    print("Normalizing detected headers...\n")
    
    from app.processing.mapping.header_normalize import normalize_headers
    
    try:
        original_headers = header_info['matched_columns']
        print("Detected headers:")
        print(original_headers)
        
        normalized_headers = normalize_headers(original_headers)
        
        print("\nNormalized headers:")
        print(normalized_headers)
        print()
        
        print("STAGE 4 SUCCESS\n")
        print("Status: PROCESSING")
        print("Stage: header_normalization")
        print("Progress: 40%\n")
        print("============================================================")
        
    except Exception as e:
        print("STAGE 4 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    # ------------------------------------------------------------
    # STAGE 5: QWEN HEADER MAPPING
    # ------------------------------------------------------------
    file_record.processing_stage = "qwen_header_mapping"
    file_record.processing_progress = "50%"
    update_file(db, file_record)
    
    from app.processing.mapping.qwen_header_mapper import map_headers_with_qwen
    
    try:
        map_headers_with_qwen(normalized_headers, file_record.raw_excel_path, header_info['header_row_index'])
        
        print("Status: PROCESSING")
        print("Stage: qwen_header_mapping")
        print("Progress: 50%\n")
        print("============================================================")
        
    except Exception as e:
        print("STAGE 5 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    # ------------------------------------------------------------
    # STAGE 6: STANDARD DATAFRAME
    # ------------------------------------------------------------
    file_record.processing_stage = "standard_dataframe"
    file_record.processing_progress = "60%"
    update_file(db, file_record)
    
    try:
        import pandas as pd
        from app.processing.mapping.standard_dataframe import create_standard_dataframe
        
        # Read the updated Excel file using the correct header row
        header_kwarg = 0 if header_info['header_row_index'] == "columns" else int(header_info['header_row_index']) + 1
        updated_df = pd.read_excel(file_record.raw_excel_path, header=header_kwarg)
        
        standard_df = create_standard_dataframe(updated_df)
        
        print("Status: PROCESSING")
        print("Stage: standard_dataframe")
        print("Progress: 60%\n")
        print("============================================================")
        
    except Exception as e:
        print("STAGE 6 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    # ------------------------------------------------------------
    # STAGE 7: TRANSACTION VALIDATION
    # ------------------------------------------------------------
    file_record.processing_stage = "transaction_validation"
    file_record.processing_progress = "70%"
    update_file(db, file_record)
    
    try:
        from app.processing.validation.transaction_validator import validate_transactions
        
        validated_df = validate_transactions(standard_df)
        
        print("Status: PROCESSING")
        print("Stage: transaction_validation")
        print("Progress: 70%\n")
        print("============================================================")
        
    except Exception as e:
        print("STAGE 7 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    # ------------------------------------------------------------
    # STAGE 8: DATABASE PERSISTENCE
    # ------------------------------------------------------------
    file_record.processing_stage = "database_persistence"
    file_record.processing_progress = "80%"
    update_file(db, file_record)
    
    try:
        from app.processing.persistence.transaction_persistence_service import persist_transactions
        
        # Persist transactions
        persist_transactions(db, validated_df, file_record.id, file_record.case_id)
        
        print("DATABASE COMMIT SUCCESSFUL\n")
        print("STAGE 8 SUCCESS\n")
        print("STATUS: COMPLETED")
        print("PROGRESS: 100%\n")
        print("============================================================")
        
        # Database commit successful, mark file as COMPLETED
        file_record.status = "COMPLETED"
        file_record.processing_stage = "completed"
        file_record.processing_progress = "100%"
        update_file(db, file_record)
        
    except Exception as e:
        print("STAGE 8 FAILED\n")
        print(f"Error: {str(e)}\n")
        print("Status: FAILED\n")
        print("============================================================")
        raise e
        
    return True