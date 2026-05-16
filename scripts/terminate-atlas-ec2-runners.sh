#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"

instance_ids="$(
  aws ec2 describe-instances \
    --filters "Name=tag:Project,Values=radmaps-atlas" "Name=tag:ManagedBy,Values=codex" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text \
    --region "$REGION"
)"

if [[ -z "$instance_ids" || "$instance_ids" == "None" ]]; then
  echo "No RadMaps atlas EC2 runners found in $REGION."
  exit 0
fi

echo "Terminating RadMaps atlas EC2 runners in $REGION: $instance_ids"
aws ec2 terminate-instances --instance-ids $instance_ids --region "$REGION"
