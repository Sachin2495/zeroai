# Backend image for AWS Lambda (container image from ECR, exposed via a Function URL).
# The AWS Lambda Web Adapter extension forwards Lambda invocations to uvicorn over HTTP,
# so the same image also runs locally with `docker run -p 8080:8080`.
FROM python:3.11-slim

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/ \
    HOME=/tmp

WORKDIR /var/task

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY main.py .
COPY app ./app

EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
