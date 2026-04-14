# Runtime Standard

Backend runtime policy:

- Python: `>=3.12,<3.15`
- Local venv path: `backend/.venv`
- Legacy `backend/venv` uses Python 3.9 and must not be used for production validation.
- Dependency source of truth: `backend/pyproject.toml`; `backend/requirements.txt` remains compatible for simple pip workflows.

Local setup:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m compileall app alembic
```
