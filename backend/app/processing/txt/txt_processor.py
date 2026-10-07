import pandas as pd
import re
import os
from typing import Tuple, Dict, Any
from datetime import datetime

def parse_date(date_str: str) -> str:
    date_str = date_str.replace('.', '-').replace('/', '-')
    try:
        if re.match(r'^\d{2}-\d{2}-\d{4}$', date_str):
            return datetime.strptime(date_str, '%d-%m-%Y').strftime('%Y-%m-%d')
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return date_str
    except ValueError:
        pass
    return date_str

def parse_amount(val: str) -> Tuple[float, bool, bool]:
    val = str(val).upper().replace(',', '').strip()
    is_credit = 'CR' in val
    is_debit = 'DR' in val
    val = val.replace('CR', '').replace('DR', '').strip()
    try:
        num = float(val)
        return num, is_credit, is_debit
    except ValueError:
        return 0.0, False, False

def detect_delimiter(lines: list) -> str:
    for delim in ['\t', '|', ';', ',']:
        counts = [line.count(delim) for line in lines if line.strip()]
        if len(counts) > 5 and max(counts) >= 3 and len(set(counts)) <= 3:
            return delim
    return None

def process_txt_file(file_path: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    encodings = ['utf-8', 'latin1', 'cp1252']
    lines = []
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                lines = f.readlines()
            break
        except Exception:
            continue
            
    if not lines:
        raise ValueError("Could not read TXT file with standard encodings")
        
    full_text = '\n'.join(lines)
    metadata = {}
    
    # Metadata extraction
    acc_match = re.search(r'(?i)(?:Account\s*No|A/c\s*No|Account\s*Number)[\s:]*([0-9X]{6,20})', full_text)
    if acc_match: metadata['account_number'] = acc_match.group(1)
        
    period_match = re.search(r'(?i)(?:Period|Statement\s*Period|From\s*Date|Date\s*Range)[\s:]*([\d]{2}[-/.][\d]{2}[-/.][\d]{2,4})\s*to\s*([\d]{2}[-/.][\d]{2}[-/.][\d]{2,4})', full_text)
    if period_match:
        metadata['statement_start_date'] = parse_date(period_match.group(1))
        metadata['statement_end_date'] = parse_date(period_match.group(2))
        
    bank_match = re.search(r'(?i)(UCO\s*BANK|STATE\s*BANK|HDFC\s*BANK|ICICI\s*BANK|AXIS\s*BANK|PUNJAB\s*NATIONAL\s*BANK)', full_text)
    if bank_match: metadata['bank_name'] = bank_match.group(1).upper()
        
    name_match = re.search(r'(?i)Account\s*No.*?INR\s+([A-Z\s]+)', full_text)
    if name_match: metadata['account_name'] = name_match.group(1).strip()
    elif acc_match:
        # fallback for name if on same line as account number
        try:
            line_with_acc = [l for l in lines if acc_match.group(1) in l][0]
            name_fallback = re.search(r'[0-9X]+\s+([A-Z][A-Z\s]+)', line_with_acc)
            if name_fallback:
                name_clean = name_fallback.group(1).split('  ')[0].replace('Gl Sub Head Code', '').strip()
                metadata['account_name'] = name_clean
        except:
            pass

    op_bal_match = re.search(r'(?i)Opening\s*Balance[\s:]*([\d,]+\.\d{2}\s*(?:Cr|Dr|CR|DR)?)', full_text)
    op_bal = None
    if op_bal_match:
        amt, is_cr, is_dr = parse_amount(op_bal_match.group(1))
        op_bal = amt if not is_dr else -amt

    delim = detect_delimiter(lines[:200])
    if delim:
        try:
            df = pd.read_csv(file_path, sep=delim, engine='python', on_bad_lines='skip')
            return df, metadata
        except Exception:
            pass

    date_regex = re.compile(r'^\s*(\d{2,4}[-/.]\d{2}[-/.]\d{2,4})')
    amount_regex = re.compile(r'((?:-?\d{1,3}(?:,\d{3})*|\d+)\.\d{2}\s*(?:Cr|Dr|CR|DR)?)(?=\s|$)', re.IGNORECASE)
    
    first_tx_idx = -1
    for i, line in enumerate(lines):
        if date_regex.match(line):
            first_tx_idx = i
            break
            
    header_block = ""
    debit_pos = -1
    credit_pos = -1
    if first_tx_idx != -1:
        header_start = max(0, first_tx_idx - 15)
        header_block = "\n".join(lines[header_start:first_tx_idx])
        for hline in header_block.split('\n'):
            d_match = re.search(r'\bdebit\b', hline, re.IGNORECASE)
            if d_match and debit_pos == -1: debit_pos = d_match.start()
            c_match = re.search(r'\bcredit\b', hline, re.IGNORECASE)
            if c_match and credit_pos == -1: credit_pos = c_match.start()

    df_rows = []
    
    for line in lines:
        line_stripped = line.rstrip('\r\n')
        date_match = date_regex.match(line_stripped)
        if not date_match:
            continue
            
        tx_date = parse_date(date_match.group(1))
        amounts_matches = list(amount_regex.finditer(line_stripped))
        
        if len(amounts_matches) < 2:
            continue
            
        amounts_matches = amounts_matches[-3:] if len(amounts_matches) >= 3 else amounts_matches
        first_amt_match = amounts_matches[0]
        desc_area = line_stripped[date_match.end():first_amt_match.start()].strip()
        
        val_date_match = date_regex.match(desc_area)
        if val_date_match:
            desc_area = desc_area[val_date_match.end():].strip()
            
        desc = desc_area
        amounts = [m.group(1) for m in amounts_matches]
        
        debit = None
        credit = None
        balance = None
        
        if len(amounts) >= 3:
            debit_val, _, _ = parse_amount(amounts[-3])
            credit_val, _, _ = parse_amount(amounts[-2])
            bal_val, is_cr, is_dr = parse_amount(amounts[-1])
            balance = bal_val if (is_cr or not is_dr) else -bal_val
            
            if debit_val > 0: debit = debit_val
            if credit_val > 0: credit = credit_val
            op_bal = balance
            
        elif len(amounts) == 2:
            amt_match = amounts_matches[-2]
            amt_val, _, _ = parse_amount(amounts[-2])
            bal_val, is_cr, is_dr = parse_amount(amounts[-1])
            
            balance = bal_val if (is_cr or not is_dr) else -bal_val
            
            if op_bal is not None:
                diff = round(balance - op_bal, 2)
                if diff > 0 and abs(diff) == amt_val:
                    credit = amt_val
                elif diff < 0 and abs(diff) == amt_val:
                    debit = amt_val
                    
            if debit is None and credit is None:
                amt_pos = amt_match.start()
                if debit_pos != -1 and credit_pos != -1:
                    dist_to_debit = abs(amt_pos - debit_pos)
                    dist_to_credit = abs(amt_pos - credit_pos)
                    if dist_to_credit < dist_to_debit:
                        credit = amt_val
                    else:
                        debit = amt_val
                else:
                    credit = amt_val
                    
            op_bal = balance
            
        df_rows.append({
            'transaction_date': tx_date,
            'description': desc,
            'debit': debit,
            'credit': credit,
            'balance': balance
        })
        
    if not df_rows:
        raise ValueError("TXT transaction table could not be detected with sufficient confidence")
        
    df = pd.DataFrame(df_rows)
    return df, metadata
