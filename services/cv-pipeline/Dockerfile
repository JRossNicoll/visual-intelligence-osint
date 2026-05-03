FROM python:3.11-slim as base

# System deps for OpenCV and ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==1.7.1

WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml poetry.lock* ./

# Pre-install problematic deps, then install the rest via poetry
RUN pip install --no-cache-dir setuptools wheel numpy \
    && pip install --no-cache-dir lap==0.4.0 \
    && poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-dev 2>/dev/null || \
       poetry install --no-interaction --no-ansi

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /tmp/viosint/frames /tmp/viosint/thumbnails

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
