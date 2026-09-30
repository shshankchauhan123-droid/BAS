def normalize_header(value: str) -> str:
    """
    Normalizes a single header string.
    - Safely converts to text.
    - Replaces line breaks and tabs with spaces.
    - Removes unnecessary repeated whitespace.
    - Trims leading/trailing whitespace.
    - Normalizes capitalization consistently (lowercase).
    """
    if value is None:
        return ""
        
    val_str = str(value)
    
    # Replace newlines, tabs, and carriage returns with space
    val_str = val_str.replace('\n', ' ').replace('\t', ' ').replace('\r', ' ')
    
    # Lowercase
    val_str = val_str.lower()
    
    # Split and rejoin to remove repeated internal whitespace, and trim outer whitespace
    words = val_str.split()
    normalized = " ".join(words)
    
    return normalized

def normalize_headers(headers: list) -> list:
    """
    Normalizes a list of detected headers.
    """
    if not headers:
        return []
        
    return [normalize_header(h) for h in headers]
