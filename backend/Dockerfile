FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts ./scripts
ENTRYPOINT ["python", "scripts/sync_responsys.py"]
