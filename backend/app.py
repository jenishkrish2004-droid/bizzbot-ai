from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from config import Config
from extensions import db, jwt
from utils.logger import configure_logging


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    configure_logging(app)
    db.init_app(app)
    jwt.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}},
        supports_credentials=True,
    )

    from routes.auth import auth_bp
    from routes.chat import chat_bp
    from routes.documents import documents_bp
    from routes.leads import leads_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(documents_bp, url_prefix="/api/documents")
    app.register_blueprint(leads_bp, url_prefix="/api/leads")

    @jwt.invalid_token_loader
    def invalid_token_callback(reason: str):
        return jsonify({"message": "Invalid authentication token", "detail": reason}), 422

    @jwt.unauthorized_loader
    def missing_token_callback(reason: str):
        return jsonify({"message": "Authentication required", "detail": reason}), 401

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return jsonify({"message": "Authentication token expired"}), 401

    if app.config["AUTO_CREATE_TABLES"]:
        with app.app_context():
            try:
                import models  # noqa: F401

                db.create_all()
                app.logger.info("Database tables are ready")
            except SQLAlchemyError:
                app.logger.exception("Could not initialize database tables")

    @app.get("/api/health")
    def health_check():
        database_status = "ok"
        try:
            db.session.execute(text("SELECT 1"))
        except SQLAlchemyError:
            app.logger.exception("Database health check failed")
            database_status = "unavailable"

        status_code = 200 if database_status == "ok" else 503
        return (
            jsonify(
                {
                    "service": "bizzbot-api",
                    "environment": app.config["APP_ENV"],
                    "status": "ok" if status_code == 200 else "degraded",
                    "database": database_status,
                }
            ),
            status_code,
        )

    @app.get("/api")
    def api_root():
        return jsonify(
                {
                    "name": "BizzBot AI API",
                    "version": "0.1.0",
                    "phase": "lead-extraction-engine",
                }
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=app.config["APP_PORT"])
