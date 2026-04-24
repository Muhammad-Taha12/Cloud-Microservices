# Microservices
## Project Overview
This project is a microservices-based event booking system that allows users to:

Register and log in (Users Service). \
Browse and manage events (Events Service). \
Create bookings (Booking Service). \
Receive notifications when a booking is confirmed (Notification Service via RabbitMQ). \
View a React frontend that ties it all together.

## Architecture
React Frontend (Users/frontend)

Built with Create React App. \
Communicates with the microservices via REST. \
Displays user data, events, and booking info. \
Users Service (Users/backend)

## Endpoints:
POST /register \
POST /login \
GET /dashboard (protected) \
Database: PostgreSQL (table: users) \
Events Service (Events/backend)

## Endpoints:
GET /events (list all events) \
POST /events (add new event) \
GET /events/:eventId/availability (check availability) \
DELETE /events/:id (delete event) \
Database: PostgreSQL (table: events) \
Booking Service (Booking/backend)

## Endpoints:
GET /bookings (list all bookings) \
POST /bookings (create a new booking, checks event availability) \
PATCH /bookings/:id (update booking status) \
Database: PostgreSQL (table: bookings) \
Publishes to RabbitMQ queue booking_confirmed when a booking is confirmed \
Notification Service (Notifications/backend)

Consumes messages from the booking_confirmed queue in RabbitMQ. \
Sends a “confirmation email”.

## RabbitMQ
Acts as the message broker for asynchronous communication between the Booking Service and Notification Service.

# API Endpoints (High-Level)
## Users Service
POST /register \
Request Body: { "username": "string", "password": "string" } \
Creates a new user in the database.

POST /login \
Request Body: { "username": "string", "password": "string" } \
Returns a JWT token on successful authentication.

GET /dashboard \
Requires Authorization header with JWT. \
Returns user info if token is valid. \
Events Service

GET /events \
Returns a list of events (id, name, availability).

POST /events \
Request Body: { "name": "string", "availability": "boolean" } \
Inserts a new event into the database.

GET /events/:eventId/availability \
Returns { "availability": boolean } for a specific event.

DELETE /events/:id \
Deletes the specified event.

## Booking Service
GET /bookings\
Returns a list of all bookings.

POST /bookings\
Request Body: { "user_id": number, "event_id": number, "tickets": number }\
Creates a new booking if the event is available. Publishes a “confirmed” event if booking already existed.

PATCH /bookings/:id\
Request Body: { "status": "pending|confirmed" }\
Updates booking status. If confirmed, publishes an event to RabbitMQ.

## Notification Service
No direct REST endpoints.\
Listens to the booking_confirmed queue.\
Sends a confirmation email to the user.

## Clone the Repository
```
git clone https://github.com/Muhammad-Taha12/Microservices.git
```

## Install Dependencies
For each microservice (Users/backend, Events/backend, Booking/backend, Notifications/backend) and the React frontend (Users/frontend), install dependencies:

```
cd Users/backend
npm install

cd ../../Events/backend
npm install

cd ../../Booking/backend
npm install

cd ../../Notifications/backend
npm install

cd ../../Users/frontend
npm install
```

## Set Up PostgreSQL Databases
Create databases for each microservice (e.g., users_db, events_db, bookings_db).
```
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  availability BOOLEAN NOT NULL
);
```

## Set Up RabbitMQ
Install and start RabbitMQ on port 5672.\
No special queues are needed in advance; each service asserts its own queue.\
Configure Environment Variables

## Each backend typically has a .env file:
DB_USER=postgres\
DB_HOST=localhost\
DB_DATABASE=events_db\
DB_PASSWORD=secret\
DB_PORT=5432

## For the Users or Booking service:
SECRET_KEY=some_secret_key \
Run the Services

## You can use concurrently in the root folder to run everything from a single terminal:
```
npm run start:users
```

## Access the App
The React frontend runs on http://localhost:3000. \
The Users Service runs on http://localhost:5000, Events on http://localhost:5001, Booking on http://localhost:5002 and Notifications on http://localhost:5003.
