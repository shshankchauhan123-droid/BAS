import logging
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.user.user_repository import get_user_by_id
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/api/v1/ws/admin-dashboard")
async def admin_dashboard_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="Admin JWT Bearer Access Token"),
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint for Admin Dashboard real-time notifications.
    Authenticates using existing JWT token mechanism and verifies that
    the user has admin/client_admin privileges and active status.
    """
    # 1. Authenticate Token
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            logger.warning("WebSocket auth failed: Missing sub claim")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = int(user_id_str)
    except Exception as exc:
        logger.warning("WebSocket auth failed: Invalid or expired token: %s", exc)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Verify User from Database
    try:
        user = get_user_by_id(db=db, user_id=user_id)
        if not user or not user.is_active:
            logger.warning("WebSocket auth failed: User %s not found or inactive", user_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        role = str(user.role).lower() if user.role else ""
        if role not in {"client_admin", "superadmin", "admin"}:
            logger.warning("WebSocket auth failed: User %s role '%s' not authorized for admin dashboard", user_id, role)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # If user belongs to a client, verify that company account is active
        if user.client_id and user.client and not user.client.is_active:
            logger.warning("WebSocket auth failed: Client %s is inactive", user.client_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    except Exception as exc:
        logger.error("WebSocket auth database error: %s", exc)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    # 3. Register Connection
    await manager.connect(websocket=websocket, client_id=user.client_id, role=role)

    # 4. Listen for client keepalives / disconnects
    try:
        while True:
            # Client can optionally send ping messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.debug("WebSocket connection closed: %s", exc)
        manager.disconnect(websocket)
