import os
import sys

# Ensure debug printing is on
os.environ["DEBUG_NLP"] = "true"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

from app.services.gliner_entity_service import extract_entities_batch
from app.services.counterparty_service import select_counterparty

def run_tests():
    examples = [
        # User requested 30 examples including UPI, IMPS, NEFT, RTGS, INB, IFT, UNKNOWN
        "RTGS/CBINR1202410010036598/M/S TRIDENT DRUGS/CENTRAL BANK OF INDIA",
        "INB/RTGS/UTIBR62024100275836915/Giriwar marketin/PUNJAB NATIONAL BANK",
        "UPI/P2A/427789268435/MS JAGDAM/Shivalik/Payment/",
        "INB/IFT/Vishalfreight/TPARTY TRANSFER",
        "UPI/P2M/194098501628/Rehman Fruits 2/Paymen/YES BANK LIMITED YBS",
        "UPI/P2A/663766766141/ANSHUMAN/PUNB/UPI/",
        "IMPS/P2A/123456789012/GAURI GANESH PHARMA/",
        "NEFT/RAHUL SHARMA/TRANSFER",
        "UPI/P2A/227267002383/NADEM NAD/UCBA/Payment/",
        "IMPS/P2A/626727051637/APIBANKI/RATNAK AR/Accountv/9112345678909176111",
        "UPI/P2A/663708572538/BALBIR SI/UCBA/UPI/",
        
        "UPI/P2A/663708572538/AMIT THA/UCBA/UPI/",
        "NEFT/UTIBR62024100275836915/Universal Petroleum/HDFC BANK",
        "IMPS/P2M/663708572538/Rinku Bakery/KOTAK",
        "RTGS/CBINR1202410010036598/KRISHNA ASSOCIATES/YES BANK",
        "INB/IFT/Brand hub/TPARTY TRANSFER",
        "UPI/P2A/427789268435/BISHOP SE/ICICI/Payment/",
        "NEFT/DISHANT S O NARESH KU/TRANSFER",
        "IMPS/P2A/123456789012/RAHUL BIS/Accountv",
        "UPI/P2M/194098501628/Khatabook/Paymen/YES BANK LIMITED",
        
        # Additional ones
        "ATM CASH WITHDRAWAL",
        "CASH DEPOSIT",
        "CHEQUE DEPOSIT",
        "NEFT/UTIBR62024100275836915/DANISH/TRANSFER",
        "RTGS/MAHB1202410010036598/RAMAN KUM/BANK OF MAHARASHTRA",
        "INB/IFT/ATUL NEGI/TPARTY TRANSFER",
        "UPI/P2V/427789268435/SAMEY SIN/Payment/",
        "IMPS/P2A/626727051637/Ujjawal/Accountv/9112345678909176111",
        "UNKNOWN/SOME RANDOM STRING",
        "UPI/P2M/194098501628/Universal Petroleum/Paymen/YES BANK LIMITED YBS",
        "NEFT/RAHUL SHARMA/TRANSFER",
        "RTGS/CBINR1202410010036598/M/S TRIDENT DRUGS/CENTRAL BANK OF INDIA"
    ]
    
    all_ents = extract_entities_batch(examples)
    
    for desc, ents in zip(examples, all_ents):
        # The mode doesn't matter much as per instructions, it's passed just in case 
        # but the fallback rule doesn't enforce entity type by mode anymore.
        mode_guess = desc.split('/')[0] if '/' in desc else "UNKNOWN"
        select_counterparty(ents, mode_guess, desc)

if __name__ == "__main__":
    run_tests()
