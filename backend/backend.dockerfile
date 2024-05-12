FROM node:latest


WORKDIR /app


COPY package*.json ./


RUN npm install


COPY . .


RUN npx prisma generate


EXPOSE 4000
EXPOSE 8080

CMD ["npm","run","start"]

