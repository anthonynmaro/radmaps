#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"
STACK_NAME="${STACK_NAME:-radmaps-render-worker-v4}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required." >&2
  exit 1
fi
if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required." >&2
  exit 1
fi

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text \
    --region "$REGION"
}

build_bucket="$(stack_output BuildBucketName)"
project_name="$(stack_output CodeBuildProjectName)"
ecr_uri="$(stack_output EcrRepositoryUri)"
cluster_name="$(stack_output ClusterName)"
service_name="$(stack_output ServiceName)"
proof_service_arn="$(stack_output ProofRendererServiceArn)"

tmp_dir="$(mktemp -d)"
zip_path="$(mktemp -t radmaps-render-worker-source.XXXXXX)"
rm -f "$zip_path"
zip_path="${zip_path}.zip"
cleanup() {
  rm -rf "$tmp_dir" "$zip_path"
}
trap cleanup EXIT

rsync -a \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'dist' \
  --exclude 'node_modules' \
  --exclude 'outputs' \
  --exclude '.tile-cache' \
  "$ROOT_DIR/render-worker-v4" "$tmp_dir/"
rsync -a "$ROOT_DIR/utils" "$tmp_dir/"
rsync -a "$ROOT_DIR/types" "$tmp_dir/"

cat > "$tmp_dir/buildspec.yml" <<'BUILDSPEC'
version: 0.2

phases:
  pre_build:
    commands:
      - aws --version
      - REGISTRY="${ECR_REPOSITORY_URI%/*}"
      - IMAGE_URI="${ECR_REPOSITORY_URI}:${IMAGE_TAG}"
      - aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
  build:
    commands:
      - docker build --platform linux/amd64 -f render-worker-v4/Dockerfile.queue -t "$IMAGE_URI" .
  post_build:
    commands:
      - docker push "$IMAGE_URI"
      - aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --force-new-deployment --region "$AWS_DEFAULT_REGION"
      - |
        if [ -n "$PROOF_RENDERER_SERVICE_ARN" ] && [ "$PROOF_RENDERER_SERVICE_ARN" != "None" ]; then
          if ! aws apprunner start-deployment --service-arn "$PROOF_RENDERER_SERVICE_ARN" --region "$AWS_DEFAULT_REGION"; then
            service_status="$(aws apprunner describe-service --service-arn "$PROOF_RENDERER_SERVICE_ARN" --query 'Service.Status' --output text --region "$AWS_DEFAULT_REGION" 2>/dev/null || true)"
            if [ "$service_status" = "OPERATION_IN_PROGRESS" ]; then
              echo "App Runner deployment already in progress; latest ECR image will be picked up by the active deployment."
            else
              exit 1
            fi
          fi
        fi
      - echo "Pushed $IMAGE_URI"
BUILDSPEC

(
  cd "$tmp_dir"
  zip -qr "$zip_path" .
)

source_key="render-worker-v4/source-$(date +%Y%m%d%H%M%S)-${IMAGE_TAG}.zip"
aws s3 cp "$zip_path" "s3://${build_bucket}/${source_key}" --region "$REGION" >/dev/null

build_id="$(
  aws codebuild start-build \
    --project-name "$project_name" \
    --source-location-override "${build_bucket}/${source_key}" \
    --environment-variables-override \
      name=IMAGE_TAG,value="$IMAGE_TAG",type=PLAINTEXT \
      name=ECR_REPOSITORY_URI,value="$ecr_uri",type=PLAINTEXT \
      name=ECS_CLUSTER,value="$cluster_name",type=PLAINTEXT \
      name=ECS_SERVICE,value="$service_name",type=PLAINTEXT \
      name=PROOF_RENDERER_SERVICE_ARN,value="$proof_service_arn",type=PLAINTEXT \
      name=AWS_DEFAULT_REGION,value="$REGION",type=PLAINTEXT \
    --query 'build.id' \
    --output text \
    --region "$REGION"
)"

echo "Started CodeBuild: $build_id"

while true; do
  build_json="$(
    aws codebuild batch-get-builds \
      --ids "$build_id" \
      --query 'builds[0].{Status:buildStatus,Log:logs.deepLink,Phases:phases}' \
      --output json \
      --region "$REGION"
  )"
  status="$(node -e "const b=JSON.parse(process.argv[1]); console.log(b.Status)" "$build_json")"
  if [[ "$status" == "SUCCEEDED" ]]; then
    log_url="$(node -e "const b=JSON.parse(process.argv[1]); console.log(b.Log || '')" "$build_json")"
    echo "CodeBuild succeeded."
    [[ -n "$log_url" && "$log_url" != "null" ]] && echo "Logs: $log_url"
    break
  fi
  if [[ "$status" == "FAILED" || "$status" == "FAULT" || "$status" == "STOPPED" || "$status" == "TIMED_OUT" ]]; then
    echo "$build_json"
    echo "CodeBuild ended with status: $status" >&2
    exit 1
  fi
  echo "CodeBuild status: $status"
  sleep 15
done
