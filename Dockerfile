FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /opt/app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src/ src/
COPY tools/ tools/
COPY base-request.json variables.json ./

USER node

CMD ["node", "src/index.js"]