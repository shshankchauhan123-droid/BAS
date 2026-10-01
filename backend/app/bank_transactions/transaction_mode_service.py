import re
from typing import List, Optional
from sqlalchemy.orm import Session
from app.bank_transactions.transaction_mode_model import TransactionMode

def get_all_modes(db: Session) -> List[str]:
    """Retrieve all available transaction modes from the database."""
    modes = db.query(TransactionMode.mode).all()
    return [m[0] for m in modes]

def detect_transaction_mode(description: str, modes: List[str]) -> Optional[str]:
    """
    Detect the transaction mode from a description based on a list of modes.
    Returns the mode string if found, otherwise None.
    If multiple modes match, returns the longest matching mode to be more specific.
    """
    if not description:
        return None
        
    matched_modes = []
    
    for mode in modes:
        pattern = r'\b' + re.escape(mode) + r'\b'
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            matched_modes.append((mode, match.start(), True))
            
    if not matched_modes:
        for mode in modes:
            if mode.upper() != "POS":
                pattern = r'\b' + re.escape(mode)
                match = re.search(pattern, description, re.IGNORECASE)
                if match:
                    matched_modes.append((mode, match.start(), False))
            
    if not matched_modes:
        return None
        
    # Sort by index of occurrence (earlier is better), then by length (longer is better)
    matched_modes.sort(key=lambda x: (x[1], -len(x[0])))
    return matched_modes[0][0]
