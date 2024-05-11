FROM node:latest


WORKDIR /app


COPY package*.json ./


RUN npm install


COPY . .


EXPOSE 3000
EXPOSE 8081


CMD ["npm","run","dev"]

