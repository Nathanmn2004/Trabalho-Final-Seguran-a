FROM node:18-alpine

WORKDIR /app

COPY attack.js .

CMD ["node", "attack.js"]
