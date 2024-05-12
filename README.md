# Speedometer FullStack Application

## Tech Used :
- **Frontend**: React
- **Backend**: Node.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Message Queue**: Kafka
- **Containerization**: Docker

## Flow of App :
- Sensor connects to backend via websocket connection and sends timeseries speed.
- Backend receives the data, processes it and sends to the frontend via websocket and also to the message queue.
- Frontend is connected to the backend via websocket connection and can subscribe to sensors listed to check their speed readings.
- Readings sent to the message queue are sent to the database via batch queries.

## Challenges faced and solved :
- **Real-Time Communication**:
  - Added websocket to solve this as normal API will not fetch real-time updates.
  - Used publisher-subscriber approach to send data across frontend and backend.
- **Multiple Queries each second to database**:
  - Used message queue (Kafka) to not query each second to the database and save data in batch to the database.
  - The data that was published to Kafka is listened to via consumer, it is received in batch and that batch is sent to the database via batch query to the database.
  - This eliminates multiple queries to the database, one producer and one consumer is used to fulfill this.

## Architecture Block Diagram : [LINK](link_to_diagram)

## Commands To Run Project And App In Local:
- **Docker Compose Up**: to start the app
- **Link to view frontend**: [Speedometer App](frontend_link)
- **Connect sensor to backend**: `ws://localhost:8080?sensorName=sensor_a` , give sensor name accordingly to any string.
- **Sent payload time series data to sensor websocket connection** : 
  - **FORMAT**: `{"speed":50,"timestamp":"2024-05-12T17:12:46Z"}`
