# Deploying to AWS Lambda (ECR container images + Function URLs)

Two Lambda functions, each running a container image from ECR:

| Function | Image source | Listens on | What it is |
|---|---|---|---|
| `zero-backend` | `backend/Dockerfile` | 8080 | FastAPI (uvicorn) |
| `zero-frontend` | `frontend/Dockerfile` | 3000 | Next.js standalone server |

Both images bundle the [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter),
so they are ordinary web servers and also run locally with `docker run`.

The browser only talks to the frontend. The frontend proxies `/api/*` to the backend server-side
(`frontend/app/api/[...path]/route.ts`) using the `BACKEND_URL` env var, read at request time. So:

- No CORS setup is needed, and the backend URL can change without rebuilding the frontend.
- Leave **CORS off** on both Function URLs (FastAPI handles it; double CORS headers break browsers).

## 1. Build and push images

```powershell
./deploy/deploy.ps1 -Region ap-south-1
```

This creates the `zero-backend` / `zero-frontend` ECR repos if missing, builds `linux/amd64`
images, and pushes them tagged with a timestamp and `latest`.

## 2. Create the functions (once)

In the Lambda console: **Create function → Container image**, pick the pushed image, architecture
**x86_64**. Then set:

| Setting | Backend | Frontend |
|---|---|---|
| Memory | 512 MB | 512 MB |
| Timeout | 60 s | 60 s |
| Function URL | Auth type `NONE`, CORS off | Auth type `NONE`, CORS off |

The frontend timeout must be at least the backend's, since it waits on the proxied call.

## 3. Environment variables

**Backend** (`zero-backend`):

| Variable | Value |
|---|---|
| `MONGODB_URI` | Atlas SRV connection string |
| `GROQ_API_KEY` | Groq key |
| `GROQ_MODEL` | optional, default `openai/gpt-oss-20b` |
| `LLM_PROVIDER` | `groq` |
| `JWT_SECRET` | long random string (signs invite + admin tokens) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin portal login |
| `FRONTEND_URL` | frontend Function URL, no trailing slash (used in invite links) |
| `CORS_ORIGINS` | frontend Function URL, or `*` |

**Frontend** (`zero-frontend`):

| Variable | Value |
|---|---|
| `BACKEND_URL` | backend Function URL, no trailing slash |

Generate a `JWT_SECRET` with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Atlas must allow connections from Lambda. Without a VPC + NAT, Lambda egress IPs are not fixed,
so the Atlas IP access list needs `0.0.0.0/0` (rely on strong DB credentials).

## Cost notes

The live setup (ap-south-1) is sized to stay inside the AWS free tier at low traffic:

- 512 MB functions (backend peaks around 160 MB); Lambda free tier is 1M requests + 400k GB-s/month.
- Each ECR repo has a lifecycle policy keeping only the newest image (~170 MB total, under 500 MB free).
- CloudWatch log groups `/aws/lambda/zero-*` keep 7 days of logs.
- No API Gateway, NAT gateway, VPC or provisioned concurrency, so nothing bills while idle.

The admin login and JWT secret generated for the deployment live in `deploy/.admin-credentials`
(gitignored).

## 4. Verify

- `GET <backend-url>/health` returns `{"status":"ok","database":"up"}`
- Open `<frontend-url>/admin`, sign in, create an invite, open the invite link.

## Redeploying

```powershell
./deploy/deploy.ps1 -Region ap-south-1 -UpdateFunctions
```

## Run locally with Docker

```powershell
docker build -t zero-backend backend
docker run --rm -p 8080:8080 --env-file backend/.env zero-backend

docker build -t zero-frontend frontend
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8080 zero-frontend
```

## Limits to know

- Function URL request/response payloads are capped at 6 MB; resume uploads are limited to 4 MB.
- Speech recognition in the interview room uses the browser's Web Speech API (Chrome/Edge).
