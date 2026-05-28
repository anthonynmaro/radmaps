# RadMaps AWS Render Worker

This stack runs `render-worker-v4` on ECS/Fargate with local Playwright Chromium
instead of Browserless, and runs a small App Runner proof renderer with a
Browserless-compatible `/screenshot` API. It keeps the same Nuxt render pages,
same render tickets, same Supabase/Gelato queue flow, and the same
`product_renders.render_backend = 'browser'` database value.

Defaults are intentionally conservative:

- `DesiredCount=0` so provisioning the stack does not start paid worker tasks.
- `RENDER_BACKEND=local-chromium`.
- `CPU=4096`, `Memory=8192`, `PRINT_WORKER_CONCURRENCY=1`.
- `GELATO_ORDER_TYPE=draft` until explicitly changed for physical fulfillment.
- App Runner keeps `MinSize=1` by default so proof thumbnails do not cold-start
  every time a user edits or shares a map.

Setup:

```bash
npm run aws:render-worker:sync-secrets
npm run aws:render-worker:deploy-infra
npm run aws:render-worker:build
aws ecs update-service \
  --cluster radmaps-render-worker-v4 \
  --service radmaps-render-worker-v4 \
  --desired-count 1 \
  --region "${AWS_REGION:-us-east-2}"
```

Watch logs:

```bash
aws logs tail /radmaps/render-worker-v4 --follow --region "${AWS_REGION:-us-east-2}"
```

Point the Nuxt app at the proof renderer:

```bash
BROWSERLESS_ENDPOINT=https://<ProofRendererUrl>
BROWSERLESS_TOKEN=<same token synced by scripts/aws-render-worker-sync-secrets.sh>
```

The App Runner proof renderer only accepts screenshot URLs from `APP_URL` by
default. To permit more production origins, set
`PROOF_RENDER_ALLOWED_ORIGINS` to a comma-separated list.

Set `GELATO_ORDER_TYPE=order` only when you are ready for real physical
fulfillment.

If Docker Desktop is running locally, `scripts/aws-render-worker-build-push.sh`
can build and push from this machine instead of CodeBuild.
