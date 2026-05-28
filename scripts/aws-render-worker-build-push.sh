#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"
STACK_NAME="${STACK_NAME:-radmaps-render-worker-v4}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but the daemon is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text \
    --region "$REGION"
}

ecr_uri="$(stack_output EcrRepositoryUri)"
cluster_name="$(stack_output ClusterName)"
service_name="$(stack_output ServiceName)"
proof_service_arn="$(stack_output ProofRendererServiceArn)"
account_id="$(aws sts get-caller-identity --query Account --output text --region "$REGION")"
image_uri="${ecr_uri}:${IMAGE_TAG}"

aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "${account_id}.dkr.ecr.${REGION}.amazonaws.com"

docker build \
  --platform "$DOCKER_PLATFORM" \
  -f "$ROOT_DIR/render-worker-v4/Dockerfile.queue" \
  -t "$image_uri" \
  "$ROOT_DIR"

docker push "$image_uri"

update_args=(--cluster "$cluster_name" --service "$service_name" --force-new-deployment --region "$REGION")
if [[ -n "${DESIRED_COUNT:-}" ]]; then
  update_args+=(--desired-count "$DESIRED_COUNT")
fi
aws ecs update-service "${update_args[@]}" >/dev/null

if [[ -n "$proof_service_arn" && "$proof_service_arn" != "None" ]]; then
  if ! aws apprunner start-deployment --service-arn "$proof_service_arn" --region "$REGION" >/dev/null; then
    proof_status="$(
      aws apprunner describe-service \
        --service-arn "$proof_service_arn" \
        --query 'Service.Status' \
        --output text \
        --region "$REGION" 2>/dev/null || true
    )"
    if [[ "$proof_status" == "OPERATION_IN_PROGRESS" ]]; then
      echo "App Runner deployment already in progress; latest ECR image will be picked up by the active deployment."
    else
      echo "Failed to start App Runner deployment for proof renderer." >&2
      exit 1
    fi
  fi
fi

echo "Pushed render worker image: $image_uri"
echo "ECS service updated: $cluster_name/$service_name"
