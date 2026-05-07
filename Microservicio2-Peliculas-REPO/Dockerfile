FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN apk add --no-cache bash netcat-openbsd
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]