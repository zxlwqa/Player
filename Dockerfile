FROM node:alpine

WORKDIR /app

COPY . .

EXPOSE 3000

RUN apk update && apk upgrade && \
    apk add --no-cache unzip zip wget curl git screen && \
    chmod +x app.js && \
    npm install && \
    chmod -R 777 /app/music || true

CMD ["npm", "start"]
