import asyncio
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Store active connections as list of dicts: {"ws": WebSocket, "client_id": int | None, "role": str}
        self.active_connections: list[dict] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket, client_id: int | None, role: str):
        await websocket.accept()
        self.active_connections.append({
            "ws": websocket,
            "client_id": client_id,
            "role": str(role).lower() if role else "",
        })
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        logger.info(
            "Admin WebSocket connected (total: %d, client_id: %s, role: %s)",
            len(self.active_connections),
            client_id,
            role,
        )

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            conn for conn in self.active_connections if conn["ws"] != websocket
        ]
        logger.info("Admin WebSocket disconnected (remaining: %d)", len(self.active_connections))

    async def broadcast_refresh(self, client_id: int | None = None):
        """
        Send {"event": "dashboard_refresh"} to connected Admin dashboards.
        - Superadmins / Admins receive all refreshes.
        - Client Admins receive refreshes matching their client_id.
        """
        if not self.active_connections:
            return

        dead_connections = []
        payload = {"event": "dashboard_refresh"}

        for conn in list(self.active_connections):
            role = conn.get("role", "")
            conn_client_id = conn.get("client_id")

            # Route event to superadmin or matching client admin
            is_super = role in {"superadmin", "admin"}
            is_matching_client = (
                client_id is not None
                and conn_client_id is not None
                and conn_client_id == client_id
            )

            if is_super or is_matching_client:
                try:
                    await conn["ws"].send_json(payload)
                except Exception as exc:
                    logger.warning("Failed to send WebSocket message: %s", exc)
                    dead_connections.append(conn["ws"])

        for dead_ws in dead_connections:
            self.disconnect(dead_ws)

    def trigger_dashboard_refresh(self, client_id: int | None = None):
        """
        Synchronous/thread-safe helper to trigger WebSocket broadcast from any context
        (e.g., synchronous login route). Does not block or throw.
        """
        try:
            if not self.active_connections:
                return

            loop = self._loop
            if loop is None or loop.is_closed():
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = None

            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast_refresh(client_id), loop)
            elif loop:
                loop.run_until_complete(self.broadcast_refresh(client_id))
        except Exception as exc:
            logger.warning("Trigger dashboard refresh via WebSocket failed safely: %s", exc)


manager = ConnectionManager()
