# Local development. The API reads DB_* (or DATABASE_URL) from the environment or a .env file.
.PHONY: install dev test

install:
	pip install -r requirements.txt -r requirements-dev.txt

dev:
	uvicorn main:app --reload --port 8080

# Needs an empty, throwaway database whose name ends in "_test", e.g.
#   DATABASE_URL=postgresql://user:pass@localhost/fifa_test make test
test:
	pytest -q
