#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"
INSTANCE_TYPE="${INSTANCE_TYPE:-m7i.4xlarge}"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-600}"
RUNNER_LABELS="${RUNNER_LABELS:-atlas-runner}"
RUNNER_NAME="${RUNNER_NAME:-radmaps-atlas-$(date +%Y%m%d%H%M%S)}"
KEY_NAME="${KEY_NAME:-radmaps-atlas-runner}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/${KEY_NAME}.pem}"
SG_NAME="${SG_NAME:-radmaps-atlas-runner-sg}"
REPO_URL="${REPO_URL:-https://github.com/anthonynmaro/radmaps}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required to create the GitHub runner registration token." >&2
  exit 1
fi

aws sts get-caller-identity --region "$REGION" >/dev/null

runner_token="$(gh api repos/anthonynmaro/radmaps/actions/runners/registration-token --method POST --jq .token)"
account_id="$(aws sts get-caller-identity --query Account --output text --region "$REGION")"
vpc_id="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text --region "$REGION")"

if [[ "$vpc_id" == "None" || -z "$vpc_id" ]]; then
  echo "No default VPC found in $REGION. Create/select a VPC or set AWS_REGION to another region." >&2
  exit 1
fi

subnet_id="$(
  aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$vpc_id" "Name=default-for-az,Values=true" \
    --query 'Subnets | sort_by(@, &AvailabilityZone)[0].SubnetId' \
    --output text \
    --region "$REGION"
)"

if [[ "$subnet_id" == "None" || -z "$subnet_id" ]]; then
  echo "No default subnet found in $REGION / $vpc_id." >&2
  exit 1
fi

ami_id="$(
  aws ssm get-parameter \
    --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
    --query 'Parameter.Value' \
    --output text \
    --region "$REGION"
)"

key_exists="$(
  aws ec2 describe-key-pairs \
    --key-names "$KEY_NAME" \
    --query 'KeyPairs[0].KeyName' \
    --output text \
    --region "$REGION" 2>/dev/null || true
)"

if [[ "$key_exists" == "$KEY_NAME" ]]; then
  :
elif [[ -f "$KEY_PATH" ]]; then
  public_key_path="$(mktemp)"
  ssh-keygen -y -f "$KEY_PATH" > "$public_key_path"
  aws ec2 import-key-pair \
    --key-name "$KEY_NAME" \
    --public-key-material "fileb://$public_key_path" \
    --region "$REGION" >/dev/null
  rm -f "$public_key_path"
else
  mkdir -p "$(dirname "$KEY_PATH")"
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query 'KeyMaterial' \
    --output text \
    --region "$REGION" > "$KEY_PATH"
  chmod 600 "$KEY_PATH"
fi

sg_id="$(
  aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$vpc_id" "Name=group-name,Values=$SG_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region "$REGION" 2>/dev/null || true
)"

if [[ "$sg_id" == "None" || -z "$sg_id" ]]; then
  sg_id="$(
    aws ec2 create-security-group \
      --group-name "$SG_NAME" \
      --description "RadMaps atlas temporary GitHub runner" \
      --vpc-id "$vpc_id" \
      --query 'GroupId' \
      --output text \
      --region "$REGION"
  )"
fi

my_ip="$(curl -fsSL https://checkip.amazonaws.com | tr -d '[:space:]')"
aws ec2 authorize-security-group-ingress \
  --group-id "$sg_id" \
  --protocol tcp \
  --port 22 \
  --cidr "${my_ip}/32" \
  --region "$REGION" >/dev/null 2>&1 || true

user_data="$(
  cat <<EOF
#!/usr/bin/env bash
set -euxo pipefail
export GITHUB_RUNNER_TOKEN='$runner_token'
export RUNNER_NAME='$RUNNER_NAME'
export RUNNER_LABELS='$RUNNER_LABELS'
export MIN_FREE_GB='500'
curl -fsSL https://raw.githubusercontent.com/anthonynmaro/radmaps/main/scripts/bootstrap-atlas-runner.sh | sudo -E bash
EOF
)"

instance_id="$(
  aws ec2 run-instances \
    --image-id "$ami_id" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$sg_id" \
    --subnet-id "$subnet_id" \
    --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=${VOLUME_SIZE_GB},VolumeType=gp3,DeleteOnTermination=true}" \
    --user-data "$user_data" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$RUNNER_NAME},{Key=Project,Value=radmaps-atlas},{Key=ManagedBy,Value=codex}]" "ResourceType=volume,Tags=[{Key=Name,Value=$RUNNER_NAME-root},{Key=Project,Value=radmaps-atlas},{Key=ManagedBy,Value=codex}]" \
    --query 'Instances[0].InstanceId' \
    --output text \
    --region "$REGION"
)"

aws ec2 wait instance-status-ok --instance-ids "$instance_id" --region "$REGION"

public_ip="$(
  aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text \
    --region "$REGION"
)"

cat <<EOF
Atlas EC2 runner requested.

AWS account: $account_id
Region: $REGION
Instance: $instance_id
Name: $RUNNER_NAME
Type: $INSTANCE_TYPE
Disk: ${VOLUME_SIZE_GB}GB gp3
Public IP: $public_ip
SSH:
  ssh -i "$KEY_PATH" ubuntu@$public_ip

Next check:
  gh api repos/anthonynmaro/radmaps/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'

Terminate when done:
  aws ec2 terminate-instances --instance-ids "$instance_id" --region "$REGION"
EOF
