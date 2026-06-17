FROM node:20-alpine

WORKDIR /app

# Tesseract OCR for scanned PDF support
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-hin \
    ghostscript \
    graphicsmagick

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5001

CMD ["node", "index.js"]