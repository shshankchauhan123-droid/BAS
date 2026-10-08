import math
from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd

def get_financial_analysis(
    db: Session,
    case_id: int,
    file_ids: List[int] = None,
    date_from: date = None,
    date_to: date = None,
    min_amount: float = None,
    max_amount: float = None,
    transaction_type: str = None,
    mode: str = None,
    counterparty_name: str = None
):
    query = "SELECT * FROM bank_transactions WHERE case_id = :case_id"
    params = {"case_id": case_id}
    
    if file_ids:
        query += " AND file_id = ANY(:file_ids)"
        params["file_ids"] = file_ids
        
    if date_from:
        query += " AND transaction_date >= :date_from"
        params["date_from"] = date_from
        
    if date_to:
        query += " AND transaction_date <= :date_to"
        params["date_to"] = date_to
        
    if transaction_type == 'debit':
        query += " AND debit > 0"
    elif transaction_type == 'credit':
        query += " AND credit > 0"
        
    if min_amount is not None:
        query += " AND GREATEST(COALESCE(debit, 0), COALESCE(credit, 0)) >= :min_amount"
        params["min_amount"] = min_amount
        
    if max_amount is not None:
        query += " AND GREATEST(COALESCE(debit, 0), COALESCE(credit, 0)) <= :max_amount"
        params["max_amount"] = max_amount
        
    if mode:
        query += " AND UPPER(mode) = :mode"
        params["mode"] = mode.upper()
        
    if counterparty_name:
        query += " AND UPPER(counterparty_name) = :counterparty_name"
        params["counterparty_name"] = counterparty_name.strip().upper()
        
    df = pd.read_sql(text(query), db.bind, params=params)
    
    if df.empty:
        return {"error": "No transactions found"}
        
    df['debit'] = pd.to_numeric(df['debit'], errors='coerce').fillna(0.0)
    df['credit'] = pd.to_numeric(df['credit'], errors='coerce').fillna(0.0)
    df['amount'] = df[['debit', 'credit']].max(axis=1)
    df['transaction_date'] = pd.to_datetime(df['transaction_date'])
    df['balance'] = pd.to_numeric(df['balance'], errors='coerce')
    
    total_debit = float(df['debit'].sum())
    total_credit = float(df['credit'].sum())
    total_value = total_debit + total_credit
    
    avg_tx = float(df['amount'].mean()) if not df.empty else 0.0
    median_tx = float(df['amount'].median()) if not df.empty else 0.0
    max_tx = float(df['amount'].max()) if not df.empty else 0.0
    max_debit = float(df['debit'].max()) if not df.empty else 0.0
    max_credit = float(df['credit'].max()) if not df.empty else 0.0
    min_tx = float(df[df['amount'] > 0]['amount'].min()) if not df[df['amount'] > 0].empty else 0.0
    
    debit_df = df[df['debit'] > 0]
    credit_df = df[df['credit'] > 0]
    
    debit_count = int(len(debit_df))
    credit_count = int(len(credit_df))
    total_count = int(len(df))
    
    avg_debit = float(debit_df['debit'].mean()) if debit_count > 0 else 0.0
    avg_credit = float(credit_df['credit'].mean()) if credit_count > 0 else 0.0
    min_debit = float(debit_df['debit'].min()) if debit_count > 0 else 0.0
    min_credit = float(credit_df['credit'].min()) if credit_count > 0 else 0.0
    
    df_sorted_amt = df.sort_values('amount', ascending=False)
    top_overall = df_sorted_amt.head(10).fillna("").to_dict('records')
    top_debit = debit_df.sort_values('debit', ascending=False).head(10).fillna("").to_dict('records')
    top_credit = credit_df.sort_values('credit', ascending=False).head(10).fillna("").to_dict('records')
    
    freq_amounts = df['amount'].value_counts().reset_index()
    freq_amounts.columns = ['amount', 'occurrences']
    freq_details = []
    for _, row in freq_amounts.head(50).iterrows():
        amt = row['amount']
        subset = df[df['amount'] == amt]
        d_cnt = len(subset[subset['debit'] > 0])
        c_cnt = len(subset[subset['credit'] > 0])
        t_type = "Debit" if d_cnt > c_cnt else ("Credit" if c_cnt > d_cnt else "Mixed")
        freq_details.append({
            "amount": float(amt),
            "occurrences": int(row['occurrences']),
            "type": t_type,
            "total_value": float(amt * row['occurrences'])
        })
        
    most_freq = freq_details[0] if freq_details else None
    
    bins = [0, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, float('inf')]
    labels = ["0-10K", "10K-50K", "50K-1L", "1L-5L", "5L-10L", "10L-50L", "50L-1Cr", "1Cr+"]
    df['amount_range'] = pd.cut(df['amount'], bins=bins, labels=labels, right=False)
    dist = df['amount_range'].value_counts(sort=False).reset_index()
    dist.columns = ['range', 'count']
    dist_list = dist.to_dict('records')
    
    df['date_str'] = df['transaction_date'].dt.strftime('%Y-%m-%d')
    daily = df.groupby('date_str').agg(
        transaction_count=('id', 'count'),
        debit=('debit', 'sum'),
        credit=('credit', 'sum')
    ).reset_index()
    daily['total_value'] = daily['debit'] + daily['credit']
    daily_list = daily.fillna(0).to_dict('records')
    
    highest_activity_dates = daily.sort_values('total_value', ascending=False).head(10).fillna(0).to_dict('records')
    
    df['month_str'] = df['transaction_date'].dt.strftime('%Y-%m')
    monthly = df.groupby('month_str').agg(
        transaction_count=('id', 'count'),
        debit=('debit', 'sum'),
        credit=('credit', 'sum')
    ).reset_index()
    monthly['net_flow'] = monthly['credit'] - monthly['debit']
    monthly_list = monthly.fillna(0).to_dict('records')
    
    q1 = df['amount'].quantile(0.25)
    q3 = df['amount'].quantile(0.75)
    iqr = q3 - q1
    threshold = q3 + 1.5 * iqr
    if threshold == 0:
        threshold = df['amount'].quantile(0.95)
        
    large_df = df[df['amount'] > threshold]
    large_tx_count = int(len(large_df))
    large_tx_value = float(large_df['amount'].sum())
    large_tx_percentage = (large_tx_value / total_value * 100) if total_value > 0 else 0.0
    large_transactions = large_df.sort_values('amount', ascending=False).head(50).fillna("").to_dict('records')
    
    top_5_val = float(df_sorted_amt.head(5)['amount'].sum())
    top_10_val = float(df_sorted_amt.head(10)['amount'].sum())
    top_25_val = float(df_sorted_amt.head(25)['amount'].sum())
    
    concentration = {
        "top_5": {"count": 5, "value": top_5_val, "percentage": (top_5_val / total_value * 100) if total_value > 0 else 0},
        "top_10": {"count": 10, "value": top_10_val, "percentage": (top_10_val / total_value * 100) if total_value > 0 else 0},
        "top_25": {"count": 25, "value": top_25_val, "percentage": (top_25_val / total_value * 100) if total_value > 0 else 0},
    }
    
    df_bal = df.dropna(subset=['balance']).sort_values('transaction_date')
    if not df_bal.empty:
        open_bal = float(df_bal.iloc[0]['balance'])
        close_bal = float(df_bal.iloc[-1]['balance'])
        high_bal = float(df_bal['balance'].max())
        low_bal = float(df_bal['balance'].min())
        avg_bal = float(df_bal['balance'].mean())
        bal_trend = df_bal.groupby('date_str')['balance'].last().reset_index()
        bal_trend_list = bal_trend.to_dict('records')
    else:
        open_bal = close_bal = high_bal = low_bal = avg_bal = 0.0
        bal_trend_list = []
        
    recurring = [f for f in freq_details if f['occurrences'] > 1]
    
    round_vals = []
    for amt in df['amount']:
        if amt >= 1000 and amt % 1000 == 0:
            round_vals.append(amt)
    
    round_series = pd.Series(round_vals).value_counts().reset_index()
    round_series.columns = ['amount', 'occurrences']
    round_details = []
    total_round_amt = 0
    total_round_cnt = 0
    for _, row in round_series.head(50).iterrows():
        amt = row['amount']
        subset = df[df['amount'] == amt]
        d_cnt = len(subset[subset['debit'] > 0])
        c_cnt = len(subset[subset['credit'] > 0])
        t_type = "Debit" if d_cnt > c_cnt else ("Credit" if c_cnt > d_cnt else "Mixed")
        val = float(amt * row['occurrences'])
        total_round_amt += val
        total_round_cnt += int(row['occurrences'])
        round_details.append({
            "amount": float(amt),
            "occurrences": int(row['occurrences']),
            "type": t_type,
            "total_value": val
        })
        
    file_comparison = []
    for fid in df['file_id'].unique():
        fdf = df[df['file_id'] == fid]
        file_comparison.append({
            "file_id": int(fid),
            "account_name": str(fdf.iloc[0].get('account_name', f"File {fid}")),
            "transaction_count": len(fdf),
            "debit": float(fdf['debit'].sum()),
            "credit": float(fdf['credit'].sum()),
            "total_value": float(fdf['debit'].sum() + fdf['credit'].sum()),
            "highest_tx": float(fdf['amount'].max()),
            "average_tx": float(fdf['amount'].mean())
        })
        
    def sanitize(v):
        return 0.0 if (pd.isna(v) or math.isnan(v)) else v
        
    def fix_df_list(lst):
        res = []
        for d in lst:
            nd = {}
            for k,v in d.items():
                if pd.isna(v): nd[k] = None
                elif isinstance(v, (int, float)): nd[k] = sanitize(v)
                elif isinstance(v, pd.Timestamp): nd[k] = v.isoformat()
                else: nd[k] = v
            res.append(nd)
        return res

    return {
        "kpis": {
            "total_value": sanitize(total_value),
            "highest_transaction": sanitize(max_tx),
            "average_transaction": sanitize(avg_tx),
            "median_transaction": sanitize(median_tx),
            "highest_debit": sanitize(max_debit),
            "highest_credit": sanitize(max_credit),
            "most_frequent_amount": most_freq
        },
        "stats": {
            "total_transactions": total_count,
            "min_transaction": sanitize(min_tx),
            "max_transaction": sanitize(max_tx),
            "avg_transaction": sanitize(avg_tx),
            "median_transaction": sanitize(median_tx),
            "total_debit": sanitize(total_debit),
            "total_credit": sanitize(total_credit),
            "debit_count": debit_count,
            "credit_count": credit_count,
            "avg_debit": sanitize(avg_debit),
            "avg_credit": sanitize(avg_credit),
            "min_debit": sanitize(min_debit),
            "min_credit": sanitize(min_credit)
        },
        "top_transactions": {
            "overall": fix_df_list(top_overall),
            "debit": fix_df_list(top_debit),
            "credit": fix_df_list(top_credit)
        },
        "most_frequent_amounts": freq_details,
        "amount_distribution": fix_df_list(dist_list),
        "daily_activity": fix_df_list(daily_list),
        "highest_activity_dates": fix_df_list(highest_activity_dates),
        "monthly_activity": fix_df_list(monthly_list),
        "large_transactions": {
            "threshold": sanitize(threshold),
            "count": large_tx_count,
            "total_value": sanitize(large_tx_value),
            "percentage": sanitize(large_tx_percentage),
            "transactions": fix_df_list(large_transactions)
        },
        "concentration": concentration,
        "balance": {
            "opening": sanitize(open_bal),
            "closing": sanitize(close_bal),
            "highest": sanitize(high_bal),
            "lowest": sanitize(low_bal),
            "average": sanitize(avg_bal),
            "trend": fix_df_list(bal_trend_list)
        },
        "recurring_amounts": recurring,
        "round_values": {
            "total_count": total_round_cnt,
            "total_amount": sanitize(total_round_amt),
            "details": round_details
        },
        "file_comparison": file_comparison
    }
