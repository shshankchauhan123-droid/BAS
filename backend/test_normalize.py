import re
import pandas as pd

def normalize_financial_value(val):
    if pd.isna(val):
        return None
    
    s = str(val).strip().lower()
    if not s or s in ["none", "nan"]:
        return None
        
    is_negative = False
    
    if s.startswith('(') and s.endswith(')'):
        is_negative = True
        s = s[1:-1].strip()
        
    s = re.sub(r'[₹,]', '', s)
    s = re.sub(r'^rs\.?\s*', '', s)
    s = re.sub(r'^inr\s*', '', s)
    s = s.strip()
    
    if s.startswith('-'):
        is_negative = True
        s = s[1:].strip()
        
    # Dr / Cr suffixes (can be attached directly like 100Cr or with space 100 Cr)
    # Be careful not to confuse 'cr' (credit) with 'cr' (crores) inside the string, 
    # but at the very end of a bank statement string, 'cr' usually means Credit.
    # Let's remove them if they are strictly at the end.
    s = re.sub(r'(?i)\s*cr\.?\s*$', '', s).strip()
    s = re.sub(r'(?i)\s*dr\.?\s*$', '', s).strip()

    # Multipliers
    multiplier = 1.0
    if re.search(r'\blakhs?\b', s) or re.search(r'\blacs?\b', s):
        multiplier = 100000.0
        s = re.sub(r'\blakhs?\b|\blacs?\b', '', s).strip()
    elif re.search(r'\bcrores?\b', s) or re.search(r'\bcr\b', s):
        multiplier = 10000000.0
        s = re.sub(r'\bcrores?\b|\bcr\b', '', s).strip()
    elif s.endswith('k') and not s.endswith('ok'): # simple check
        multiplier = 1000.0
        s = s[:-1].strip()
    elif s.endswith('m'):
        multiplier = 1000000.0
        s = s[:-1].strip()
    elif s.endswith('b'):
        multiplier = 1000000000.0
        s = s[:-1].strip()
    
    # Strip any remaining Dr/Cr that weren't at the end just to be safe (with boundaries)
    s = re.sub(r'\bcr\.?\b', '', s).strip()
    s = re.sub(r'\bdr\.?\b', '', s).strip()
    
    if not s:
        return "invalid"
        
    try:
        num = float(s)
        num = num * multiplier
        if is_negative:
            num = -num
        return round(num, 2)
    except ValueError:
        return "invalid"

print("10,300.00Cr ->", normalize_financial_value("10,300.00Cr"))
print("10300.00cr ->", normalize_financial_value("10300.00cr"))
print("500.00Dr ->", normalize_financial_value("500.00Dr"))
print("1,70,298.00Cr ->", normalize_financial_value("1,70,298.00Cr"))
print("10,300.00 ->", normalize_financial_value("10,300.00"))
print("0.00 ->", normalize_financial_value("0.00"))
print("Rs. 10,300.00 ->", normalize_financial_value("Rs. 10,300.00"))
print("1,00,000.00 ->", normalize_financial_value("1,00,000.00"))
print("12,34,56,789.25 ->", normalize_financial_value("12,34,56,789.25"))
print("(10,300.00) ->", normalize_financial_value("(10,300.00)"))
print("-10,300.00 ->", normalize_financial_value("-10,300.00"))
print("0 ->", normalize_financial_value("0"))
print("NaN ->", normalize_financial_value("NaN"))
print("'' ->", normalize_financial_value(""))
print("abc ->", normalize_financial_value("abc"))
