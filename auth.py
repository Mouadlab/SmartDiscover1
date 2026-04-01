"""
Middleware WSGI d'authentification Basic.
Protège toutes les routes sans modifier app.py.
Render démarre via : gunicorn --timeout=120 --workers=2 auth:application
"""
import base64
from app import app as flask_app

AUTH_USER = "SmartKeyword"
AUTH_PASS = "Sm@rtkeyword2026xCo$mo5"
REALM     = "SmartDiscover"

VALID_TOKEN = base64.b64encode(
    f"{AUTH_USER}:{AUTH_PASS}".encode()
).decode()


class BasicAuthMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        auth_header = environ.get("HTTP_AUTHORIZATION", "")

        if auth_header.startswith("Basic "):
            token = auth_header[len("Basic "):]
            if token == VALID_TOKEN:
                # Passe directement — ne bufferise pas, laisse le stream SSE intact
                return self.wsgi_app(environ, start_response)

        # Identifiants absents ou incorrects → 401
        start_response(
            "401 Unauthorized",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("WWW-Authenticate", f'Basic realm="{REALM}"'),
                ("Content-Length", "19"),
            ]
        )
        return [b"Acces non autorise."]


application = BasicAuthMiddleware(flask_app)
