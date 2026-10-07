import pandas as pd
import io
import re

text = '''   GL.     Value       Instrmnt         Particulars                                               Transaction          Transaction                Balance   Entry     Verified
   Date    Date         Number                                                                   Debit Amount        Credit Amount                          User Id   User Id
 ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/655173285716/MANASRANJANP/FDRL/XXX5                                     110.00             2,542.43Cr CDCI      CDCI
'''

def infer_colspecs(lines):
    # pandas actually has a function to infer fwf colspecs
    from pandas.io.parsers.readers import _make_parser_function
    # It's hidden in pandas, let's just write a simple column detector
    # A column starts where non-space characters begin, and ends where space-padding starts
    # Just look at all lines and find indices where ALL lines have a space
    pass

header_text = text.split('---')[0]
debit_match = re.search(r'\bdebit\b', header_text, re.IGNORECASE)
credit_match = re.search(r'\bcredit\b', header_text, re.IGNORECASE)

print("Debit pos:", debit_match.start() if debit_match else -1)
print("Credit pos:", credit_match.start() if credit_match else -1)

# In the data line:
line = " 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/655173285716/MANASRANJANP/FDRL/XXX5                                     110.00             2,542.43Cr CDCI      CDCI"
print("Char at debit pos:", line[debit_match.start():debit_match.start()+15])
print("Char at credit pos:", line[credit_match.start():credit_match.start()+15])

