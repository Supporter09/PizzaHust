FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi==0.136.1 \
    uvicorn[standard]==0.46.0 \
    httpx==0.28.1 \
    pydantic==2.13.3

COPY . .

EXPOSE 9000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
