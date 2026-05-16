FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY backend/supabase ./supabase
COPY backend/README.md ./README.md

EXPOSE 8080

CMD ["npm", "start"]
