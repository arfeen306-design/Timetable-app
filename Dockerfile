# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build Python Backend
FROM python:3.10-slim AS backend
WORKDIR /app

# Install system dependencies required for psycopg2 and others
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# First copy the requirements files
COPY requirements.txt ./root-requirements.txt
COPY backend/requirements.txt ./backend-requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r root-requirements.txt \
    && pip install --no-cache-dir -r backend-requirements.txt

# Copy shared engine folders
COPY core/ ./core/
COPY solver/ ./solver/
COPY models/ ./models/
COPY utils/ ./utils/
COPY exports/ ./exports/
COPY database/ ./database/

# Copy backend application
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Ensure module imports work across the /app root
ENV PYTHONPATH=/app

# Expose the API and Web port
EXPOSE 8000

# Start command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
