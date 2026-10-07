import pandas as pd
import io

text = ''' 24-09-2026  24-09-2026                 ATM CASH WITHDRAWAL DELH                           110.00             2,542.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/008866302277/MarjiaKhanam/YESB/XXX0                100.00                                  2,442.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 FUNDS TRANSFER TO RAMESH                             1,030.00             2,739.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 POS PURCHASE BIGB                                100.00                                  2,639.43Cr CDCI      CDCI
'''
df = pd.read_fwf(io.StringIO(text), header=None)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print(df)
