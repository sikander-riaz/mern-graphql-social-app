
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 5000
ENV PORT=5000

# Run seeder at container startup
CMD sh -c "node utils/seeds.js && node index.js"


