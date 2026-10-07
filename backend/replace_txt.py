filepath = r'c:\final bas\BAS_YASH_2_ZIP\BAS\backend\app\processing\processing_service.py'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        print("\\nSTAGE 1 RAW EXCEL SUCCESS\\n")
        file_record.raw_excel_path = saved_path
    else:
        raise ValueError(f"Unsupported file format for processing: {file_extension}")'''

replacement = '''        print("\\nSTAGE 1 RAW EXCEL SUCCESS\\n")
        file_record.raw_excel_path = saved_path
        
    elif file_extension == ".txt":
        print("============================================================")
        print("STAGE 1 - TXT PARSING")
        print("============================================================")
        print("\\nFile is TXT. Extracting structure and metadata...\\n")
        
        from app.processing.txt.txt_processor import process_txt_file
        
        raw_df, txt_meta = process_txt_file(file_record.file_path)
        
        if raw_df is None or len(raw_df) == 0:
            raise ValueError("TXT transaction table could not be detected with sufficient confidence")
            
        try:
            if txt_meta:
                if txt_meta.get('account_number') and not file_record.account_number:
                    file_record.account_number = txt_meta['account_number']
                if txt_meta.get('account_name') and not file_record.account_name:
                    file_record.account_name = txt_meta['account_name']
                if txt_meta.get('bank_name') and not file_record.bank_name:
                    file_record.bank_name = txt_meta['bank_name']
                if txt_meta.get('branch_name') and not file_record.branch_name:
                    file_record.branch_name = txt_meta['branch_name']
                if txt_meta.get('ifsc') and not file_record.ifsc:
                    file_record.ifsc = txt_meta['ifsc']
                if txt_meta.get('account_type') and not file_record.account_type:
                    file_record.account_type = txt_meta['account_type']
                if txt_meta.get('statement_start_date') and not file_record.statement_start_date:
                    file_record.statement_start_date = txt_meta['statement_start_date']
                if txt_meta.get('statement_end_date') and not file_record.statement_end_date:
                    file_record.statement_end_date = txt_meta['statement_end_date']
                
                update_file(db, file_record)
                print("TXT Account metadata stored successfully")
        except Exception as e:
            print(f"Account metadata extraction for TXT failed: {e}")
            
        file_path = Path(file_record.file_path)
        excel_filename = f"{file_path.stem}_raw.xlsx"
        excel_path = file_path.parent / excel_filename
        
        saved_path = save_raw_excel(raw_df, str(excel_path))
        print(f"Raw Excel saved:\\n{saved_path}")
        
        print("\\nSTAGE 1 RAW EXCEL SUCCESS\\n")
        file_record.raw_excel_path = saved_path
    else:
        raise ValueError(f"Unsupported file format for processing: {file_extension}")'''

new_text = text.replace(target, replacement)
if target in text:
    print("Replaced successfully!")
else:
    print("Target not found.")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_text)

