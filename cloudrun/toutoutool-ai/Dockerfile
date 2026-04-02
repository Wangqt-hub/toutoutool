FROM node:18-bullseye-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY pixel-styles.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
