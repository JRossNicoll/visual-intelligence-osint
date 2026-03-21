FROM python:3.11-slim as base

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==1.7.1

WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml poetry.lock* ./

# Install dependencies (no dev deps in production)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-dev 2>/dev/null || \
       poetry install --no-interaction --no-ansi

# Copy application code
COPY . .

# Create directories for uploads/thumbnails
RUN mkdir -p /app/uploads /app/thumbnails /tmp/viosint

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--loop", "uvloop", "--http", "httptools"]
