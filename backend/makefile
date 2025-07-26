# =======================================
# Configuration
# =======================================
PROJECT_ID := simplestorageproject-467016
REGION := us-central1
SERVICE_NAME := simple
IMAGE_NAME := gcr.io/$(PROJECT_ID)/$(SERVICE_NAME)
PORT := 8080

# Database configuration
DB_USER := simple
DB_PASS := simple
DB_NAME := simple_db
INSTANCE_CONNECTION := $(PROJECT_ID):$(REGION):simple  # Replace 'simple-postgres' with your instance name

# =======================================
# Targets
# =======================================

.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make set-project   - Set the Google Cloud project"
	@echo "  make enable-apis   - Enable required GCP services"
	@echo "  make build         - Build and push Docker image with Cloud Build"
	@echo "  make deploy        - Deploy service to Cloud Run with Cloud SQL"
	@echo "  make all           - Build & deploy"
	@echo "  make run           - Run backend locally"
	@echo "  make clean         - Remove local Docker images"

# Set the GCP project
.PHONY: set-project
set-project:
	gcloud config set project $(PROJECT_ID)

# Enable necessary GCP services
.PHONY: enable-apis
enable-apis: set-project
	gcloud services enable run.googleapis.com containerregistry.googleapis.com sqladmin.googleapis.com

# Build Docker image and push to Container Registry
.PHONY: build
build: enable-apis
	gcloud builds submit --tag $(IMAGE_NAME)

# Deploy service to Cloud Run with Cloud SQL connection
.PHONY: deploy
deploy: set-project
	gcloud run deploy $(SERVICE_NAME) \
		--image $(IMAGE_NAME) \
		--platform managed \
		--region $(REGION) \
		--allow-unauthenticated \
		--port $(PORT) \
		--add-cloudsql-instances $(INSTANCE_CONNECTION) \
		--update-env-vars DATABASE_URL="postgresql://$(DB_USER):$(DB_PASS)@/$(DB_NAME)?host=/cloudsql/$(INSTANCE_CONNECTION)"

# Build and deploy
.PHONY: all
all: build deploy

# Run locally with uvicorn
.PHONY: run
run:
	uvicorn app.main:app --host 0.0.0.0 --port $(PORT) --reload

# Clean local Docker image
.PHONY: clean
clean:
	docker rmi $(IMAGE_NAME) || true
