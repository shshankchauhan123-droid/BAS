filepath = r"backend\app\dashboard\dashboard_route.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("from app.core.security import get_current_user", "from app.dependencies.auth import get_current_user")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
