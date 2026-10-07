import re

text = '''   GL.     Value       Instrmnt         Particulars                                               Transaction          Transaction                Balance   Entry     Verified
   Date    Date         Number                                                                   Debit Amount        Credit Amount                          User Id   User Id'''

debit_pos = -1
credit_pos = -1

for line in text.split('\n'):
    d = re.search(r'\bdebit\b', line, re.IGNORECASE)
    if d: debit_pos = d.start()
    c = re.search(r'\bcredit\b', line, re.IGNORECASE)
    if c: credit_pos = c.start()

print("Debit pos:", debit_pos)
print("Credit pos:", credit_pos)

data_line = " 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/655173285716/MANASRANJANP/FDRL/XXX5                                     110.00             2,542.43Cr CDCI      CDCI"
print("Debit snippet:", repr(data_line[debit_pos-5:debit_pos+15]))
print("Credit snippet:", repr(data_line[credit_pos-5:credit_pos+15]))
