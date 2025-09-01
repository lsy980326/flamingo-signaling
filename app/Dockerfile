FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN pnpm install --prod # pnpm을 사용하려면 RUN npm i -g pnpm && pnpm install --prod
COPY dist ./dist
CMD [ "node", "dist/src/server.js" ]