"""Compatibility entry point for the structured FastAPI application."""

from parking_api.main import app

import json
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


HOST = "127.0.0.1"
PORT = 8000
DATABASE_PATH = Path(__file__).with_name("parking.db")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )


class ApiHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        origin = self.headers.get("Origin", "")
        parsed = urlparse(origin)
        if parsed.hostname in {"localhost", "127.0.0.1"} and parsed.port in {None, 5173}:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        if urlparse(self.path).path != "/api/login":
            self._send_json(404, {"error": "Endpoint not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 4096:
                self._send_json(400, {"error": "Request body is missing or too large"})
                return
            payload = json.loads(self.rfile.read(content_length))
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"error": "Request must contain valid JSON"})
            return

        email = payload.get("email", "") if isinstance(payload, dict) else ""
        if not isinstance(email, str):
            self._send_json(400, {"error": "Email must be text"})
            return

        email = email.strip().lower()
        if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            self._send_json(400, {"error": "Enter a valid email address"})
            return

        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with sqlite3.connect(DATABASE_PATH) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute(
                "INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)",
                (email, created_at),
            )
            user = connection.execute(
                "SELECT id, email, created_at FROM users WHERE email = ?", (email,)
            ).fetchone()

        self._send_json(200, {"user": dict(user)})

    def log_message(self, format_string, *args):
        print(f"{self.log_date_time_string()} - {args[0]}")


if __name__ == "__main__":
    raise SystemExit(
        "The SQLite API has been replaced. From backend/, run: "
        "uv run uvicorn parking_api.main:app --reload --host 127.0.0.1 --port 8000"
    )
