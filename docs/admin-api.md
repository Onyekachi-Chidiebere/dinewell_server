# Admin API Documentation

This document describes the admin authentication and management API endpoints.

## Base URL
All admin endpoints are prefixed with `/admin`

## Authentication
Most admin endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Admin Login
**POST** `/admin/login`

Authenticate an admin user with email and password.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminpassword"
}
```

**Response (Success):**
```json
{
  "message": "Admin login successful",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "type": "admin",
    "approval_status": 1,
    "date_created": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error):**
```json
{
  "error": "Invalid email or password"
}
```

### 2. Create Admin
**POST** `/admin/create`

Create a new admin account (for super admin use).

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "password": "securepassword",
  "name": "New Admin"
}
```

**Response (Success):**
```json
{
  "message": "Admin account created successfully",
  "admin": {
    "id": 2,
    "email": "newadmin@example.com",
    "name": "New Admin",
    "type": "admin",
    "approval_status": 1,
    "date_created": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Get Admin Profile
**GET** `/admin/profile`

Get the current admin's profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (Success):**
```json
{
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "type": "admin",
    "approval_status": 1,
    "date_created": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. Update Admin Password
**PUT** `/admin/password`

Update the current admin's password.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Response (Success):**
```json
{
  "message": "Password updated successfully"
}
```

## Error Responses

All endpoints may return the following error responses:

- **401 Unauthorized**: Invalid or expired token
- **403 Forbidden**: Admin access required or account not approved
- **400 Bad Request**: Invalid request data
- **500 Internal Server Error**: Server error

## Security Features

1. **Password Hashing**: All passwords are hashed using bcrypt with salt rounds of 12
2. **JWT Tokens**: Access tokens expire in 15 minutes, refresh tokens in 2 hours
3. **Type Validation**: Only users with `type: 'admin'` can access admin endpoints
4. **Approval Status**: Only approved admins (approval_status: 1) can login
5. **Token Verification**: All protected routes verify JWT tokens and admin status

## Usage Examples

### Creating the First Admin
```bash
curl -X POST http://localhost:3000/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dinewell.com",
    "password": "admin123",
    "name": "System Admin"
  }'
```

### Admin Login
```bash
curl -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dinewell.com",
    "password": "admin123"
  }'
```

### Accessing Protected Route
```bash
curl -X GET http://localhost:3000/admin/profile \
  -H "Authorization: Bearer <access_token>"
```
