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

    # ------------------------------------------------------------
    # ACCOUNT METADATA EXTRACTION
    # ------------------------------------------------------------
    file_record.status = "PROCESSING"
    file_record.processing_stage = "account_metadata_extraction"
    file_record.processing_progress = "5%"
    update_file(db, file_record)

    from app.processing.account.account_metadata_extractor import extract_account_metadata
    
    print("============================================================")
    print("ACCOUNT METADATA EXTRACTION")
    print("============================================================")
    print(f"\nFile:\n{file_record.file_path}\n")
    print("Extracting account metadata...\n")

    file_extension = Path(file_record.file_path).suffix.lower()

    if file_extension == ".pdf":
        try:
            metadata = extract_account_metadata(file_record.file_path)
            
            if metadata.account_name and not file_record.account_name:
                file_record.account_name = metadata.account_name
            if metadata.account_number and not file_record.account_number:
                file_record.account_number = metadata.account_number
            if metadata.bank_name and not file_record.bank_name:
                file_record.bank_name = metadata.bank_name
            if metadata.branch_name and not file_record.branch_name:
                file_record.branch_name = metadata.branch_name
            if metadata.ifsc and not file_record.ifsc:
                file_record.ifsc = metadata.ifsc
            if metadata.micr and not file_record.micr:
                file_record.micr = metadata.micr
            if metadata.account_type and not file_record.account_type:
                file_record.account_type = metadata.account_type
            if metadata.statement_start_date and not file_record.statement_start_date:
                file_record.statement_start_date = metadata.statement_start_date
            if metadata.statement_end_date and not file_record.statement_end_date:
                file_record.statement_end_date = metadata.statement_end_date
            
            update_file(db, file_record)

            print(f"Account Name: {metadata.account_name or 'None'}")
            
            # Mask account number for logs
            if metadata.account_number:
                masked_acc = metadata.account_number
                if len(masked_acc) > 4:
                    masked_acc = "X" * (len(masked_acc) - 4) + masked_acc[-4:]
                print(f"Account Number: {masked_acc}")
            else:
                print("Account Number: None")
                
            print(f"Bank Name: {metadata.bank_name or 'None'}")
            print(f"Branch: {metadata.branch_name or 'None'}")
            print(f"IFSC: {metadata.ifsc or 'None'}")
            print(f"MICR: {metadata.micr or 'None'}")
            print(f"Account Type: {metadata.account_type or 'None'}")
            print(f"Statement Start Date: {metadata.statement_start_date or 'None'}")
            print(f"Statement End Date: {metadata.statement_end_date or 'None'}\n")
            
            print("ACCOUNT METADATA EXTRACTION SUCCESS")
            print("============================================================\n")

        except Exception as e:
            print("ACCOUNT METADATA EXTRACTION FAILED\n")
            print(f"Error: {str(e)}\n")
            print("Status: FAILED\n")
            print("============================================================")
            raise e
    else:
        print(f"Skipping PDF metadata extraction for {file_extension} file.\n")
        print("============================================================\n")

    # ------------------------------------------------------------
    # STAGE 1 - PDF TABLE EXTRACTION OR EXCEL BYPASS
    # ------------------------------------------------------------

    if file_extension == ".pdf":
        file_record.processing_stage = "pdf_table_extraction"
        file_record.processing_progress = "10%"
        update_file(db, file_record)

        print("============================================================")
        print("STAGE 1 - PDF TABLE EXTRACTION")
        print("============================================================")
        print("\nStarting PDF table extraction...\n")

        try:
            # This function will print its own logs (PDF TABLE EXTRACTION...)
            raw_df = extract_tables_from_pdf(file_record.file_path)
            
            if raw_df is None or len(raw_df) == 0:
                raise ValueError("Standard PDF table extraction produced no usable transaction table (empty dataframe)")
                
            # Robust heuristic for unusable table (e.g. image text recognized as one big column)
            is_usable = False
            if len(raw_df.columns) >= 3:
                expected_keywords = ["date", "chq", "cheque", "particulars", "narration", "description", "debit", "withdrawal", "credit", "deposit", "balance"]
                match_count = 0
                
                # Check columns first
                for col in raw_df.columns:
                    val_str = str(col).lower().replace('\n', ' ').strip()
                    if any(kw in val_str for kw in expected_keywords):
                        match_count += 1
                        
                # Check rows
                import pandas as pd
                for i in range(min(50, len(raw_df))):
                    row_match = 0
                    for val in raw_df.iloc[i].values:
                        if pd.isna(val): continue
                        val_str = str(val).lower().replace('\n', ' ').strip()
                        if any(kw in val_str for kw in expected_keywords):
                            row_match += 1
                    if row_match > match_count:
                        match_count = row_match
                        
                if match_count >= 3:
                    is_usable = True
                    
            if not is_usable:
                raise ValueError("Standard PDF table extraction produced no usable transaction table (no valid header concepts detected)")
                
            print("\nStandard PDF table extraction successful")
            print(f"Rows extracted: {len(raw_df)}")
            print(f"Columns extracted: {len(raw_df.columns)}")
            
        except Exception as e:
            print("\nProcessing PDF:", file_record.file_path)
            print("Attempting standard PDF extraction")
            print(f"Standard PDF extraction produced no usable transaction table: {e}")
            print("Falling back to OCR")
            print("OCR processing started\n")
            
            from app.processing.ocr.ocr_table_extractor import extract_tables_from_scanned_pdf_ocr
            raw_df = extract_tables_from_scanned_pdf_ocr(file_record.file_path)
            
            print("\nOCR extraction completed")
            print(f"Rows extracted: {len(raw_df)}")
            print("Continuing with existing header mapping")
            print("Continuing with existing validation")
            print("Continuing with existing persistence")

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
    elif file_extension in [".xlsx", ".xls", ".csv"]:
        print("============================================================")
        print("STAGE 1 - EXCEL/CSV BYPASS")
        print("============================================================")
        print("\nFile is Excel or CSV. Creating raw Excel from uploaded file...\n")
        
        import pandas as pd
        if file_extension == ".csv":
            from app.processing.csv.csv_reader import load_csv_dataframe
            raw_df = load_csv_dataframe(file_record.file_path)
        else:
            raw_df = pd.read_excel(file_record.file_path)
            
        # ------------------------------------------------------------
        # EXCEL/CSV ACCOUNT METADATA EXTRACTION
        # ------------------------------------------------------------
        from app.processing.account.account_metadata_extractor import extract_excel_account_metadata
        try:
            excel_meta = extract_excel_account_metadata(raw_df)
            
            if excel_meta.account_number and not file_record.account_number:
                file_record.account_number = excel_meta.account_number
                masked_acc = excel_meta.account_number
                if len(masked_acc) > 4:
                    masked_acc = "X" * (len(masked_acc) - 4) + masked_acc[-4:]
                print(f"Account number extracted: {masked_acc}")
            else:
                print("Account number not updated.")
                
            if excel_meta.account_name and not file_record.account_name:
                file_record.account_name = excel_meta.account_name
                print(f"Account name extracted: {excel_meta.account_name}")
            else:
                print("Account name not updated.")
                
            if excel_meta.bank_name and not file_record.bank_name:
                file_record.bank_name = excel_meta.bank_name
            if excel_meta.branch_name and not file_record.branch_name:
                file_record.branch_name = excel_meta.branch_name
            if excel_meta.ifsc and not file_record.ifsc:
                file_record.ifsc = excel_meta.ifsc
            if excel_meta.micr and not file_record.micr:
                file_record.micr = excel_meta.micr
            if excel_meta.account_type and not file_record.account_type:
                file_record.account_type = excel_meta.account_type
            if excel_meta.statement_start_date and not file_record.statement_start_date:
                file_record.statement_start_date = excel_meta.statement_start_date
            if excel_meta.statement_end_date and not file_record.statement_end_date:
                file_record.statement_end_date = excel_meta.statement_end_date
                
            # If ANY field was extracted, we should update
            if any([
                excel_meta.account_number, excel_meta.account_name, excel_meta.bank_name,
                excel_meta.branch_name, excel_meta.ifsc, excel_meta.micr, excel_meta.account_type,
                excel_meta.statement_start_date, excel_meta.statement_end_date
            ]):
                update_file(db, file_record)
                print("Account metadata stored successfully")
        except Exception as e:
            print(f"Account metadata extraction for Excel/CSV failed: {e}")
            
        print("Transaction rows continuing through existing pipeline")

            
        file_path = Path(file_record.file_path)
        excel_filename = f"{file_path.stem}_raw.xlsx"
        excel_path = file_path.parent / excel_filename
        
        saved_path = save_raw_excel(raw_df, str(excel_path))
        print(f"Raw Excel saved:\n{saved_path}")
        
        print("\nSTAGE 1 RAW EXCEL SUCCESS\n")
        file_record.raw_excel_path = saved_path
    else:
        raise ValueError(f"Unsupported file format for processing: {file_extension}")

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
        is_excel_mode = file_extension != ".pdf"
        map_headers_with_qwen(normalized_headers, file_record.raw_excel_path, header_info['header_row_index'], is_excel=is_excel_mode)
        
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