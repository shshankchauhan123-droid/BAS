import os
import re
import cv2
import numpy as np
import pandas as pd
import pymupdf as fitz
from PIL import Image
import io

try:
    import pytesseract
    from pytesseract import Output
    if os.name == 'nt':
        default_tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(default_tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = default_tesseract_path
except ImportError:
    pytesseract = None


def preprocess_image_for_ocr(img_data: bytes) -> np.ndarray:
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Otsu's thresholding for better text clarity
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return thresh


def get_logical_lines(ocr_data, min_conf=30):
    """
    Group OCR words into horizontal logical lines based on their vertical coordinates.
    """
    words = []
    n_boxes = len(ocr_data['text'])
    for i in range(n_boxes):
        if int(ocr_data['conf'][i]) > min_conf:
            text = ocr_data['text'][i].strip()
            if text:
                words.append({
                    'text': text,
                    'left': ocr_data['left'][i],
                    'top': ocr_data['top'][i],
                    'width': ocr_data['width'][i],
                    'height': ocr_data['height'][i],
                    'right': ocr_data['left'][i] + ocr_data['width'][i],
                    'bottom': ocr_data['top'][i] + ocr_data['height'][i],
                    'center_y': ocr_data['top'][i] + (ocr_data['height'][i] / 2)
                })
    
    if not words:
        return []

    # Sort words primarily by top coordinate
    words.sort(key=lambda w: w['top'])

    lines = []
    current_line = [words[0]]

    for i in range(1, len(words)):
        word = words[i]
        
        # Use the first word of the line as an anchor to prevent snowballing bounds
        anchor = current_line[0]
        # Increase margin to accommodate slightly skewed scans
        margin = anchor['height'] * 0.8
        
        if (anchor['top'] - margin) <= word['center_y'] <= (anchor['bottom'] + margin):
            current_line.append(word)
        else:
            current_line.sort(key=lambda w: w['left'])
            lines.append(current_line)
            current_line = [word]

    if current_line:
        current_line.sort(key=lambda w: w['left'])
        lines.append(current_line)

    return lines


def is_header_line(line, expected_keywords):
    """
    Check if a logical line contains at least 3 header keywords.
    """
    match_count = 0
    matched = set()
    for word in line:
        val_str = word['text'].lower()
        for keyword in expected_keywords:
            if keyword in val_str and keyword not in matched:
                match_count += 1
                matched.add(keyword)
                break
    return match_count >= 3


def is_summary_line(line):
    """
    Check if a line looks like a statement summary or footer.
    """
    text = " ".join([w['text'].lower() for w in line])
    summary_keywords = ["statement summary", "total debits", "total credits", "dr count", "cr count", "generated on", "page no"]
    for keyword in summary_keywords:
        if keyword in text:
            return True
    return False


def determine_column_boundaries(header_line):
    """
    Return a list of X-coordinates that split the columns, plus the header names.
    """
    grouped_headers = []
    if not header_line:
        return [], []
        
    current_col = [header_line[0]]
    for i in range(1, len(header_line)):
        word = header_line[i]
        prev_word = current_col[-1]
        
        distance = word['left'] - prev_word['right']
        # Reduce the threshold to prevent merging distinct columns. 
        # Usually, inter-column space is larger than inter-word space.
        if distance < prev_word['height'] * 0.6:
            current_col.append(word)
        else:
            grouped_headers.append(current_col)
            current_col = [word]
    if current_col:
        grouped_headers.append(current_col)
        
    column_names = [" ".join(w['text'] for w in col) for col in grouped_headers]
    
    split_points = [0]
    for i in range(len(grouped_headers) - 1):
        left_col_right = max(w['right'] for w in grouped_headers[i])
        right_col_left = min(w['left'] for w in grouped_headers[i+1])
        midpoint = (left_col_right + right_col_left) / 2.0
        split_points.append(midpoint)
        
    split_points.append(float('inf'))
    
    return split_points, column_names


def map_line_to_columns(line, split_points):
    """
    Map words in a line to columns based on their X coordinates relative to split_points.
    """
    num_cols = len(split_points) - 1
    row_data = ["" for _ in range(num_cols)]
    
    for word in line:
        center_x = word['left'] + (word['width'] / 2)
        for i in range(num_cols):
            if split_points[i] <= center_x < split_points[i+1]:
                if row_data[i]:
                    row_data[i] += " " + word['text']
                else:
                    row_data[i] = word['text']
                break
                
    return row_data


def validate_ocr_output(df: pd.DataFrame) -> bool:
    """
    Validate the generated OCR dataframe to ensure it represents a meaningful transaction table.
    """
    if df.empty:
        return False
        
    num_cols = len(df.columns) - 1 # excluding _source_page
    num_rows = len(df)
    
    if num_cols < 3:
        print(f"Validation failed: Too few columns ({num_cols}).")
        return False
        
    if num_rows < 2:
        print(f"Validation failed: Too few rows ({num_rows}).")
        return False
        
    # Check if all columns are just merged into one giant cell for many rows
    # A heuristic: if average word count per cell in a column is extremely high, it's likely a mis-parse
    avg_len_per_col = []
    for col in df.columns[:-1]:
        lengths = df[col].astype(str).str.len()
        avg_len = lengths.mean()
        avg_len_per_col.append(avg_len)
        
    # If the variance or length is huge, it's probably parsing the whole page as 1 cell
    if any(avg > 100 for avg in avg_len_per_col):
        print("Validation failed: Unusually long text in columns, indicating poor column splitting.")
        return False

    # Try to find meaningful date or financial values in the dataframe (ignoring the header row 0)
    has_date = False
    has_amount = False
    
    # We scan the first few rows of the data
    for i in range(1, min(10, num_rows)):
        for col in df.columns[:-1]:
            val = str(df.iloc[i][col]).strip()
            # Simple date regex (dd/mm/yyyy, dd-MMM-yy, etc.)
            if re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', val) or re.search(r'\d{1,2}\s+[a-zA-Z]{3}\s+\d{2,4}', val):
                has_date = True
            # Simple amount regex (numbers with decimal)
            if re.search(r'\d+\.\d{2}', val):
                has_amount = True
                
    if not has_date and not has_amount:
        print("Validation failed: Could not find transaction-like data (dates or amounts).")
        return False
        
    return True


def extract_tables_from_scanned_pdf_ocr(pdf_path: str) -> pd.DataFrame:
    print("============================================================")
    print("OCR TABLE EXTRACTION (COORDINATE-BASED)")
    print("============================================================")
    print(f"Input PDF: {pdf_path}\n")

    if not pytesseract:
        raise ImportError("pytesseract is not installed. Cannot run OCR extraction.")

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        raise RuntimeError(f"Failed to open PDF with PyMuPDF: {e}")

    expected_keywords = [
        "date", "chq", "cheque", "particulars", "narration", "description", 
        "debit", "withdrawal", "credit", "deposit", "balance", "ref", "value dt"
    ]
    
    global_split_points = None
    global_column_names = None
    all_rows = []

    for page_num in range(len(doc)):
        print(f"Running OCR on page {page_num + 1}/{len(doc)}...")
        page = doc.load_page(page_num)
        
        zoom = 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        thresh = preprocess_image_for_ocr(pix.tobytes("png"))
        
        try:
            # PSM 11 works well for sparse text
            ocr_data = pytesseract.image_to_data(thresh, config='--psm 11', output_type=Output.DICT)
        except Exception as e:
            print(f"Tesseract failed on page {page_num + 1}: {e}")
            continue
            
        lines = get_logical_lines(ocr_data)
        
        in_table = False
        
        for line in lines:
            if is_summary_line(line):
                if in_table:
                    print(f"  Statement summary detected. Stopping extraction for page {page_num + 1}.")
                    break
                else:
                    # Ignore summary lines before the table starts
                    continue
                
            if is_header_line(line, expected_keywords):
                print(f"  Header detected on page {page_num + 1}.")
                split_points, column_names = determine_column_boundaries(line)
                if len(split_points) - 1 >= 3:
                    global_split_points = split_points
                    global_column_names = column_names
                    in_table = True
                    # Add the header row itself to the table as row 0
                    all_rows.append(column_names + [page_num + 1])
                    continue
                    
            if in_table and global_split_points:
                row_data = map_line_to_columns(line, global_split_points)
                if "".join(row_data).strip():
                    all_rows.append(row_data + [page_num + 1])

    doc.close()

    if not all_rows or not global_column_names:
        raise ValueError("OCR extraction produced no usable tables.")

    df = pd.DataFrame(all_rows)
    # The last column we appended is the source page
    df.rename(columns={df.columns[-1]: "_source_page"}, inplace=True) 
    
    if not validate_ocr_output(df):
        raise ValueError(f"OCR output validation failed. Shape was: {df.shape}")
        
    print()
    print("============================================================")
    print("OCR EXTRACTION RESULT")
    print("============================================================")
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns) - 1}")
    print("\nRAW DATA PREVIEW:")
    print(df.head(10).to_string())
    print("============================================================")

    return df
