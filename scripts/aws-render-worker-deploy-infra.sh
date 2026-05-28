#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"
STACK_NAME="${STACK_NAME:-radmaps-render-worker-v4}"
SECRET_NAME="${SECRET_NAME:-radmaps/render-worker-v4/env}"
PROOF_TOKEN_SECRET_NAME="${PROOF_TOKEN_SECRET_NAME:-radmaps/proof-renderer/token}"
TEMPLATE_FILE="${TEMPLATE_FILE:-$ROOT_DIR/infra/aws/render-worker/cloudformation.yaml}"

PROJECT_NAME="${PROJECT_NAME:-radmaps}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-production}"
SERVICE_NAME="${SERVICE_NAME:-render-worker-v4}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DESIRED_COUNT="${DESIRED_COUNT:-0}"
CPU="${CPU:-4096}"
MEMORY="${MEMORY:-8192}"
APP_URL="${APP_URL:-https://radmaps.studio}"
GELATO_ORDER_TYPE="${GELATO_ORDER_TYPE:-draft}"
RENDER_TIMEOUT_MS="${RENDER_TIMEOUT_MS:-180000}"
PRINT_WORKER_CONCURRENCY="${PRINT_WORKER_CONCURRENCY:-1}"
PRINT_WORKER_POLL_MS="${PRINT_WORKER_POLL_MS:-2000}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
ASSIGN_PUBLIC_IP="${ASSIGN_PUBLIC_IP:-ENABLED}"
PROOF_RENDER_TIMEOUT_MS="${PROOF_RENDER_TIMEOUT_MS:-120000}"
PROOF_SERVICE_CPU="${PROOF_SERVICE_CPU:-2 vCPU}"
PROOF_SERVICE_MEMORY="${PROOF_SERVICE_MEMORY:-4 GB}"
PROOF_SERVICE_MIN_SIZE="${PROOF_SERVICE_MIN_SIZE:-1}"
PROOF_SERVICE_MAX_SIZE="${PROOF_SERVICE_MAX_SIZE:-5}"
PROOF_SERVICE_MAX_CONCURRENCY="${PROOF_SERVICE_MAX_CONCURRENCY:-10}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

worker_secret_arn="${WORKER_SECRET_ARN:-}"
if [[ -z "$worker_secret_arn" ]]; then
  worker_secret_arn="$(
    aws secretsmanager describe-secret \
      --secret-id "$SECRET_NAME" \
      --query ARN \
      --output text \
      --region "$REGION"
  )"
fi

proof_token_secret_arn="${PROOF_TOKEN_SECRET_ARN:-}"
if [[ -z "$proof_token_secret_arn" ]]; then
  proof_token_secret_arn="$(
    aws secretsmanager describe-secret \
      --secret-id "$PROOF_TOKEN_SECRET_NAME" \
      --query ARN \
      --output text \
      --region "$REGION"
  )"
fi

vpc_id="${VPC_ID:-}"
if [[ -z "$vpc_id" ]]; then
  vpc_id="$(
    aws ec2 describe-vpcs \
      --filters Name=is-default,Values=true \
      --query 'Vpcs[0].VpcId' \
      --output text \
      --region "$REGION"
  )"
fi
if [[ -z "$vpc_id" || "$vpc_id" == "None" ]]; then
  echo "No VPC found. Set VPC_ID or choose a region with a default VPC." >&2
  exit 1
fi

subnet_ids="${SUBNET_IDS:-}"
if [[ -z "$subnet_ids" ]]; then
  subnet_ids="$(
    aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=$vpc_id" "Name=default-for-az,Values=true" \
      --query 'Subnets[].SubnetId' \
      --output text \
      --region "$REGION" | tr '\t' ','
  )"
fi
if [[ -z "$subnet_ids" || "$subnet_ids" == "None" ]]; then
  echo "No subnets found. Set SUBNET_IDS to a comma-separated subnet list." >&2
  exit 1
fi

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --tags Project=radmaps Service=render-worker-v4 ManagedBy=codex \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    EnvironmentName="$ENVIRONMENT_NAME" \
    ServiceName="$SERVICE_NAME" \
    ImageTag="$IMAGE_TAG" \
    DesiredCount="$DESIRED_COUNT" \
    Cpu="$CPU" \
    Memory="$MEMORY" \
    VpcId="$vpc_id" \
    SubnetIds="$subnet_ids" \
    AssignPublicIp="$ASSIGN_PUBLIC_IP" \
    WorkerSecretArn="$worker_secret_arn" \
    ProofTokenSecretArn="$proof_token_secret_arn" \
    AppUrl="$APP_URL" \
    GelatoOrderType="$GELATO_ORDER_TYPE" \
    RenderTimeoutMs="$RENDER_TIMEOUT_MS" \
    WorkerConcurrency="$PRINT_WORKER_CONCURRENCY" \
    WorkerPollMs="$PRINT_WORKER_POLL_MS" \
    LogRetentionDays="$LOG_RETENTION_DAYS" \
    ProofRenderTimeoutMs="$PROOF_RENDER_TIMEOUT_MS" \
    ProofServiceCpu="$PROOF_SERVICE_CPU" \
    ProofServiceMemory="$PROOF_SERVICE_MEMORY" \
    ProofServiceMinSize="$PROOF_SERVICE_MIN_SIZE" \
    ProofServiceMaxSize="$PROOF_SERVICE_MAX_SIZE" \
    ProofServiceMaxConcurrency="$PROOF_SERVICE_MAX_CONCURRENCY"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table \
  --region "$REGION"
