import os
import sys

sys.path.insert(0, os.path.abspath("backend"))
from dotenv import load_dotenv

load_dotenv("backend/.env")

from app.core.database import SessionLocal
import app.case.case_model
from app.ncrp.ncrp_repository import get_ncrp_hierarchical_graph_data

db = SessionLocal()
graph = get_ncrp_hierarchical_graph_data(
    db, 12, root_account="009950110016022", expand_all=True
)

print(f"Total nodes in graph from root 009950110016022: {len(graph['nodes'])}")
for n in graph["nodes"]:
    if "50200094009630" in n["account"]:
        print("\nNode 50200094009630 in graph:")
        print("  account:", n["account"])
        print("  bank:", n["bank"])
        print("  layer:", n["layer"])
        print("  layer_num:", n["layer_num"])
        print("  total_in:", n["total_in"])
        print("  total_out:", n["total_out"])
        print("  disputed_in:", n["disputed_in"])
        print("  tx_count:", n["tx_count"])

print("\nEdges connected to 50200094009630 in graph:")
for e in graph["edges"]:
    if "50200094009630" in e["source_acc"] or "50200094009630" in e["target_acc"]:
        print(
            f"  {e['source_acc']} -> {e['target_acc']} | Amt: {e['amount']} | "
            f"Txs: {e['tx_count']} | Layer: {e['layer']}"
        )
        if e.get("transactions"):
            for tx in e["transactions"]:
                print(
                    f"    Row #{tx.get('row_number')} | UTR: {tx.get('utr')} | "
                    f"Date: {tx.get('date')} | Amt: {tx.get('amount')} | "
                    f"Disp: {tx.get('disputed_amount')}"
                )

db.close()
