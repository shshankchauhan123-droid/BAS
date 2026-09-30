#!/usr/bin/env python3
"""
Helper script to quickly view all PostgreSQL database tables and their row counts.
Usage:
    cd backend
    venv/bin/python show_db_tables.py
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

# Load .env file
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in .env")
    exit(1)

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        print("\n" + "=" * 55)
        print(" 📊 DATABASE: bas (PostgreSQL)")
        print("=" * 55)
        print(f"{'Table Name':<32} {'Rows Count':<12}")
        print("-" * 55)

        for table in sorted(tables):
            try:
                count_res = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
                print(f" • {table:<30} {count_res:<12}")
            except Exception:
                print(f" • {table:<30} {'(error)'}")

        print("=" * 55 + "\n")

except Exception as err:
    print("\n❌ Could not connect to PostgreSQL database.")
    print("👉 Reason:", str(err))
    print("\n💡 Tip: Make sure the PostgreSQL service is running:")
    print("   sudo service postgresql start\n")
