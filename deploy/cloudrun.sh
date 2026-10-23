#!/bin/sh
# Deploy to Google Cloud Run (bonus track). Default region europe-north1 (Finland), marked "Low CO2" by Google Cloud. Needs CI vars: GCP_PROJECT, GCP_REGION, GCP_SA_KEY (masked, file type).
set -eu
SERVICE="$1"
gcloud auth activate-service-account --key-file="$GCP_SA_KEY"
gcloud run deploy "$SERVICE" --project "$GCP_PROJECT" --region "${GCP_REGION:-europe-north1}" \
  --source . --allow-unauthenticated --min-instances 0 --max-instances 2 --cpu 1 --memory 256Mi \
  --set-env-vars "APP_VERSION=${CI_COMMIT_SHORT_SHA:-local}"
