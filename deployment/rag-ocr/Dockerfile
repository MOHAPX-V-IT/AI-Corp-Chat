FROM ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       poppler-utils \
       tesseract-ocr \
       tesseract-ocr-eng \
       tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

COPY app/utils/document_loader.py /app/app/utils/document_loader.py

WORKDIR /app
CMD ["python", "main.py"]
