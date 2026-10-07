import pandas as pd
import io

text = '''   GL.     Value       Instrmnt         Particulars                                               Transaction          Transaction                Balance   Entry     Verified
   Date    Date         Number                                                                   Debit Amount        Credit Amount                          User Id   User Id
 ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/655173285716/MANASRANJANP/FDRL/XXX5                                     110.00             2,542.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/008866302277/MarjiaKhanam/YESB/XXX0                100.00                                  2,442.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/626739012641/PAWANBEAKTA/PUNB/XXX36                                   1,030.00             2,739.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/813143231374/SUBHRAJITDATT/UCBA/XXX                100.00                                  2,639.43Cr CDCI      CDCI
 25-09-2026  25-09-2026                 MPAY/UPI/TRTR/216483869742/BIHARIKUMAR/IPOS/XXX56                                     300.00             3,059.43Cr CDCI      CDCI
 25-09-2026  25-09-2026                 MPAY/UPI/TRTR/729907152464/BADAL/UCBA/XXX8116                  2,000.00                                  1,059.43Cr CDCI      CDCI
'''

df = pd.read_fwf(io.StringIO(text))
print(df.head())
print(df.columns)
