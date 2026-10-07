import pandas as pd
import io
import re

text = ''' 24-09-2026  24-09-2026                 ATM CASH WITHDRAWAL DELH                           110.00             2,542.43Cr CDCI      CDCI'''

df = pd.read_fwf(io.StringIO(text), header=None)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print(df)
