filepath = r"backend\app\main.py"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

import re
text = text.replace('from app.websocket.websocket_route import router as websocket_router', 'from app.websocket.websocket_route import router as websocket_router\nfrom app.dashboard.dashboard_route import router as dashboard_router')
text = text.replace('app.include_router(websocket_router)', 'app.include_router(websocket_router)\napp.include_router(dashboard_router)')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
