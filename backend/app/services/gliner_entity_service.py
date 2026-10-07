import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Cache for the loaded model to prevent reloading
_GLINER_MODEL = None
_GLINER_INITIALIZED = False

def get_gliner_config():
    return {
        "enabled": os.getenv("GLINER_ENABLED", "true").lower() == "true",
        "model_name": os.getenv("GLINER_MODEL_NAME", "urchade/gliner_multi_pii-v1"),
        "threshold": float(os.getenv("GLINER_THRESHOLD", "0.50")),
        "batch_size": int(os.getenv("GLINER_BATCH_SIZE", "32"))
    }

def init_gliner_model():
    global _GLINER_MODEL, _GLINER_INITIALIZED
    
    if _GLINER_INITIALIZED:
        return _GLINER_MODEL
        
    config = get_gliner_config()
    _GLINER_INITIALIZED = True
    
    if not config["enabled"]:
        logger.info("GLiNER is disabled via configuration.")
        return None
        
    try:
        from gliner import GLiNER
        logger.info(f"Loading GLiNER model: {config['model_name']}...")
        _GLINER_MODEL = GLiNER.from_pretrained(config["model_name"])
        logger.info("GLiNER model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load GLiNER model '{config['model_name']}': {e}")
        _GLINER_MODEL = None
        
    return _GLINER_MODEL

def extract_entities_batch(descriptions: List[str]) -> List[List[Dict[str, Any]]]:
    """
    Extract entities for a batch of descriptions using GLiNER.
    Returns a list of entity lists (one per description).
    """
    config = get_gliner_config()
    
    if not config["enabled"]:
        return [[] for _ in descriptions]
        
    model = init_gliner_model()
    if not model:
        logger.warning("GLiNER model is not available. Skipping entity extraction.")
        return [[] for _ in descriptions]
        
    labels = [
        "PERSON", 
        "ORGANIZATION", 
        "MERCHANT", 
        "BANK", 
        "FINANCIAL_INSTITUTION", 
        "LOCATION", 
        "UPI_ID", 
        "ACCOUNT_NUMBER", 
        "TRANSACTION_REFERENCE", 
        "PHONE_NUMBER", 
        "EMAIL"
    ]
    
    try:
        # Bank statements are often ALL CAPS, which degrades zero-shot NER models like GLiNER.
        # We transform text to titlecase for the model inference.
        # Replacing slashes with commas helps GLiNER tokenize discrete entities much better.
        title_descriptions = [d.title().replace("/", ", ") for d in descriptions]
        
        # GLiNER batch inference
        predictions = model.batch_predict_entities(title_descriptions, labels, threshold=0.1)
        
        # Map boundaries back to the original strings to preserve exact text casing
        mapped_predictions = []
        import re
        for orig_text, preds in zip(descriptions, predictions):
            mapped_ents = []
            for ent in preds:
                start, end = ent['start'], ent['end']
                extracted_str = title_descriptions[len(mapped_predictions)][start:end].strip()
                if not extracted_str:
                    continue
                
                # We need to find this string in the original text. 
                # Since we added commas instead of '/', we revert them before searching
                search_str = extracted_str.replace(", ", "/")
                search_str = search_str.replace(",", "/")
                
                # Escape regex chars
                search_str = re.escape(search_str)
                # Allow optional spaces/slashes around slashes in the match just in case
                search_str = search_str.replace(r"\/", r"\s*[/,]\s*")
                
                match = re.search(search_str, orig_text, re.IGNORECASE)
                if match:
                    mapped_ents.append({
                        'text': match.group(0),
                        'label': ent['label'],
                        'score': ent['score']
                    })
                else:
                    # Fallback
                    mapped_ents.append({
                        'text': extracted_str.replace(", ", "/").upper(),
                        'label': ent['label'],
                        'score': ent['score']
                    })
            mapped_predictions.append(mapped_ents)
            
        return mapped_predictions
    except Exception as e:
        logger.error(f"Error during GLiNER batch prediction: {e}")
        # Fallback to empty results on error so we don't break the pipeline
        return [[] for _ in descriptions]
