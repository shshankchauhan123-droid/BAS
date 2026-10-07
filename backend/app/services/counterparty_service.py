import logging
from typing import List, Dict, Any
import pandas as pd
from app.services.gliner_entity_service import extract_entities_batch, get_gliner_config

logger = logging.getLogger(__name__)

# Same token sets as before for validation
TECHNICAL_TOKENS = {
    "UPI", "IMPS", "NEFT", "RTGS", "INB", "IFT", "MOB", "ATM", "POS", "CASH", 
    "CHEQUE", "TRANSFER", "PAYMENT", "COLLECT", "PAY TO", "ACCOUNT", "ACCOUNTV",
    "DR", "CR", "DEBIT", "CREDIT", "SENT", "P2A", "P2M", "P2P", "P2V", "PAYMEN", 
    "TPARTY", "TPARTY TRANSFER", "FUNDS", "FUNDS TRANSFER", "BIL", "REV", "RET",
    "WITHDRAWAL", "DEPOSIT", "CHGS", "CASH DEPOSIT", "CHEQUE DEPOSIT", "ATM CASH WITHDRAWAL", "GST", "FEE", "TXN", "REF", "REFERENCE", "PAY"
}

BANK_TOKENS = {
    "SBIN", "UBIN", "UCBA", "MAHB", "YES BANK", "YES BANK LIMITED", "YBS",
    "CNRB", "PUNB", "UTIB", "IDIB", "HPSC", "APIBANKI", "BANK", "BANKING",
    "HDFC", "ICICI", "AXIS", "KOTAK", "BOB", "BOI", "CANARA BANK", "FEDERAL BANK",
    "UCO BANK", "INDIAN BANK", "PAYTM", "PAYTM BANK", "AIRTEL", "JIO",
    "CENTRAL BANK OF INDIA", "PUNJAB NATIONAL BANK", "SHIVALIK", "SHIVALIK BANK"
}

def is_technical_or_bank(text: str) -> bool:
    clean = text.strip(" /-_").upper()
    if not clean:
        return True
    
    # Pure numbers are not valid names
    import re
    if re.match(r'^[\d.\-]+$', clean):
        return True
        
    if clean in TECHNICAL_TOKENS or clean in BANK_TOKENS:
        return True
        
    if clean.endswith(" BANK") or clean.startswith("BANK ") or clean.endswith(" BANK LIMITED"):
        return True
        
    return False

def is_identifier_string(text: str) -> bool:
    clean = text.strip(" /-_").upper()
    if not clean:
        return False
    import re
    if re.search(r'[a-zA-Z0-9.\-_]+@[a-zA-Z]+', clean):
        return True
    if re.match(r'^\d{10,}$', clean):
        return True
    if re.match(r'^[A-Z]{3,5}[0-9]{6,}[A-Z0-9]*$', clean):
        return True
    return False

def clean_extracted_entity(text: str) -> str:
    """Removes technical tokens from the beginning and end of extracted entities."""
    if not text:
        return text
        
    # Split by / to handle cases like INB/IFT/Brand hub
    parts = text.split('/')
    cleaned_parts = []
    
    for p in parts:
        clean_p = p.strip()
        if not clean_p:
            continue
        # If the part is purely a technical token, skip it
        if clean_p.upper() in TECHNICAL_TOKENS:
            continue
        # If it contains space-separated tokens, check if the whole thing is technical
        if clean_p.upper() in TECHNICAL_TOKENS:
            continue
        cleaned_parts.append(clean_p)
        
    return "/".join(cleaned_parts).strip(" /-_")

def select_best_entity(entities: List[Dict[str, Any]], threshold: float) -> Dict[str, Any]:
    """Select the best valid counterparty from GLiNER entities."""
    valid_candidates = []
    rejected = []
    
    for ent in entities:
        orig_text = ent.get("text", "")
        label = ent.get("label", "")
        score = ent.get("score", 0.0)
        
        if score < threshold:
            rejected.append(f"{orig_text} ({label}) - Low score {score:.2f}")
            continue
            
        if label not in ["PERSON", "ORGANIZATION", "MERCHANT", "UPI_ID", "TRANSACTION_REFERENCE", "LOCATION"]:
            rejected.append(f"{orig_text} ({label}) - Invalid type")
            continue
            
        # Clean the text
        text = clean_extracted_entity(orig_text)
        
        if not text:
            rejected.append(f"{orig_text} ({label}) - Only technical tokens")
            continue
            
        if is_technical_or_bank(text):
            rejected.append(f"{text} ({label}) - Technical/Bank")
            continue
            
        if is_identifier_string(text):
            rejected.append(f"{text} ({label}) - Identifier")
            continue
            
        # If the model mislabeled a valid name as an identifier category, correct it
        if label in ["UPI_ID", "TRANSACTION_REFERENCE"]:
            label = "PERSON" # Default fallback for mislabeled names
            ent["label"] = label
        elif label == "LOCATION":
            label = "ORGANIZATION" # Default fallback for mislabeled locations
            ent["label"] = label
            
        # Update text with cleaned text
        ent["text"] = text
        valid_candidates.append(ent)
        
    print(f"GLiNER ENTITIES: {entities}")
    print(f"REJECTED ENTITIES: {rejected}")
        
    if not valid_candidates:
        return {}
        
    # Sort by score descending and return highest
    valid_candidates.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    return valid_candidates[0]

def extract_counterparties_batch(transactions_df: pd.DataFrame) -> Dict[Any, Dict[str, Any]]:
    """
    Process a batch of transactions and return counterparty mapping.
    """
    config = get_gliner_config()
    
    # We only process unique descriptions to save compute
    unique_txs = transactions_df.drop_duplicates(subset=['description']).to_dict('records')
    unique_descriptions = [str(tx.get('description', '')) for tx in unique_txs]
    
    logger.info(f"COUNTERPARTY_PIPELINE_STARTED transactions={len(transactions_df)} unique={len(unique_descriptions)}")
    
    batch_size = config.get("batch_size", 32)
    threshold = config.get("threshold", 0.20)
    
    all_unique_results = {}
    
    for i in range(0, len(unique_descriptions), batch_size):
        batch_descs = unique_descriptions[i:i + batch_size]
        logger.info(f"COUNTERPARTY_BATCH_STARTED batch={(i//batch_size)+1} size={len(batch_descs)}")
        
        batch_entities = extract_entities_batch(batch_descs)
        
        for desc, entities in zip(batch_descs, batch_entities):
            best_ent = select_best_entity(entities, threshold)
            
            if best_ent:
                all_unique_results[desc] = {
                    "counterparty_name": best_ent.get("text"),
                    "counterparty_type": best_ent.get("label"),
                    "counterparty_confidence": float(best_ent.get("score", 0.0)),
                    "counterparty_source": "GLINER",
                    "counterparty_status": "FOUND"
                }
            else:
                all_unique_results[desc] = {
                    "counterparty_name": None,
                    "counterparty_type": None,
                    "counterparty_confidence": None,
                    "counterparty_source": None,
                    "counterparty_status": "NOT_FOUND"
                }
                
    # Map back to dataframe indices
    final_mapping = {}
    for idx, row in transactions_df.iterrows():
        desc = str(row.get("description", ""))
        final_mapping[idx] = all_unique_results.get(desc, {
            "counterparty_name": None,
            "counterparty_type": None,
            "counterparty_confidence": None,
            "counterparty_source": None,
            "counterparty_status": "NOT_FOUND"
        })
        
    logger.info("COUNTERPARTY_VALIDATION_COMPLETED")
    return final_mapping
