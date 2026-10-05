FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY scripts ./scripts
ENTRYPOINT ["python", "scripts/sync_responsys.py"]
