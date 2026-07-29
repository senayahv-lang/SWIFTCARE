FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install && npm install --prefix client && npm install --prefix server
COPY . .
RUN npm run build
ENV PORT=3001
ENV DATABASE_PATH=/app/server/data/triage.db
EXPOSE 3001
CMD ["npm", "start"]
