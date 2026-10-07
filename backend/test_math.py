import re

text = '''
 Opening Balance  :             2,432.43Cr
 Peg Review date  : 31-12-2099
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/655173285716/MANASRANJANP/FDRL/XXX5                                     110.00             2,542.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/008866302277/MarjiaKhanam/YESB/XXX0                100.00                                  2,442.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/626739012641/PAWANBEAKTA/PUNB/XXX36                                   1,030.00             2,739.43Cr CDCI      CDCI
'''

def parse_amount(val):
    val = str(val).upper().replace(',', '').strip()
    is_credit = 'CR' in val
    is_debit = 'DR' in val
    val = val.replace('CR', '').replace('DR', '').strip()
    try:
        num = float(val)
        if is_debit: num = -num # If Dr, let's just keep positive but flag it
        return num, is_credit, is_debit
    except:
        return 0.0, False, False

# Find opening balance
op_bal = 0.0
m = re.search(r'(?i)Opening\s*Balance[\s:]*([\d,]+\.\d{2}\s*(?:Cr|Dr|CR|DR)?)', text)
if m:
    amt, is_cr, is_dr = parse_amount(m.group(1))
    op_bal = amt if is_cr else -amt

print("Opening Balance:", op_bal)

date_regex = re.compile(r'^\s*(\d{2,4}[-/.]\d{2}[-/.]\d{2,4})')
amount_regex = re.compile(r'((?:-?\d{1,3}(?:,\d{3})*|\d+)\.\d{2}\s*(?:Cr|Dr|CR|DR)?)(?=\s|$)', re.IGNORECASE)

transactions = []
for line in text.split('\n'):
    if date_regex.match(line):
        amounts = amount_regex.findall(line)
        desc = line
        print("Line:", line.strip())
        print("Amounts:", amounts)
        
        debit, credit = None, None
        if len(amounts) == 2:
            amt_val, _, _ = parse_amount(amounts[0])
            bal_val, is_cr, is_dr = parse_amount(amounts[1])
            balance = bal_val if is_cr else -bal_val
            
            diff = round(balance - op_bal, 2)
            if diff > 0:
                credit = amt_val
            elif diff < 0:
                debit = amt_val
            op_bal = balance
            
        print(f"Debit: {debit}, Credit: {credit}, Balance: {op_bal}")
        print()

