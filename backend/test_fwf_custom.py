import pandas as pd
import io

text = ''' 24-09-2026  24-09-2026                 ATM CASH WITHDRAWAL DELH                           110.00             2,542.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 MPAY/UPI/TRTR/008866302277/MarjiaKhanam/YESB/XXX0                100.00                                  2,442.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 FUNDS TRANSFER TO RAMESH                             1,030.00             2,739.43Cr CDCI      CDCI
 24-09-2026  24-09-2026                 POS PURCHASE BIGB                                100.00                                  2,639.43Cr CDCI      CDCI
'''

lines = [l for l in text.split('\n') if l.strip()]

max_len = max(len(l) for l in lines)
is_space = [True] * max_len
for line in lines:
    for i, char in enumerate(line):
        if char != ' ':
            is_space[i] = False

# find boundaries where is_space is True for at least 2 consecutive characters
colspecs = []
start = 0
in_boundary = False
bound_start = -1
for i in range(max_len):
    if is_space[i]:
        if not in_boundary:
            in_boundary = True
            bound_start = i
    else:
        if in_boundary:
            in_boundary = False
            if i - bound_start >= 2:
                colspecs.append((start, bound_start))
                start = i
colspecs.append((start, max_len))

print("Colspecs:", colspecs)
df = pd.read_fwf(io.StringIO('\n'.join(lines)), colspecs=colspecs, header=None)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print(df)
