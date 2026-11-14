# TripNest Backend

The TripNest backend is an Express API for destinations, user profiles, and
bookings. It uses MongoDB for persistence and JWTs for protected API access.

## Related project

The frontend application is available at:

[TripNest frontend](https://github.com/mehrabislam00/TripNest.git)

## Requirements

- Node.js 18 or newer
- MongoDB Atlas (or a compatible MongoDB deployment)
- A JWT issuer that exposes a JWKS endpoint

## Installation

```bash
npm install
```

Create a `.env` file in the project root:

```env
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password
AUTH_JWKS_URL=http://localhost:3000/api/auth/jwks
PORT=5000
```

Never commit `.env` or database credentials.

## Running locally

Start the development server:

```bash
npm run dev
```

The API is available at `http://localhost:5000`.

## Authentication

Protected routes require a valid Bearer token:

```http
Authorization: Bearer <jwt>
```

The backend verifies the token using `AUTH_JWKS_URL`. The root health-check
endpoint (`GET /`) is public.

## API routes

| Method | Route | Authentication |
| --- | --- | --- |
| GET | `/` | Public |
| GET | `/destinations` | Required |
| GET | `/destinations/:id` | Required |
| GET | `/user/:id` | Required |
| PATCH | `/user/:id` | Required |
| GET | `/bookings` | Required |
| POST | `/bookings` | Required |
| PATCH | `/bookings/:id` | Required |

### User profile updates

`PATCH /user/:id` accepts `name`, `email`, `phone`, `address`, and `avatar`.
Password changes must be handled by the authentication system.

## Deployment

This project includes a `vercel.json` configuration for Vercel. Deploy with:

```bash
npx vercel
```

Configure the MongoDB and authentication environment variables in the Vercel
project settings before deploying.
