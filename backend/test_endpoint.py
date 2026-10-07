import urllib.request
import urllib.error

url = 'http://127.0.0.1:8000/api/v1/bank-transactions/case/38/summary?file_ids=194'

try:
    with urllib.request.urlopen(url) as response:
        print("Status Code:", response.getcode())
        print("Response:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error Status Code:", e.code)
    print("Response:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
