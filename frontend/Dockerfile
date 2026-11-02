# Frontend image for AWS Lambda (container image from ECR, exposed via a Function URL).
# Next.js "standalone" output runs as a plain Node server; the AWS Lambda Web Adapter
# extension forwards Lambda invocations to it. Runs locally too: `docker run -p 3000:3000`.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    AWS_LWA_PORT=3000 \
    AWS_LWA_READINESS_CHECK_PATH=/ \
    HOME=/tmp

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Lambda's filesystem is read-only except /tmp; point Next's runtime cache there
RUN rm -rf ./.next/cache && ln -s /tmp/next-cache ./.next/cache

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /tmp/next-cache && exec node server.js"]
