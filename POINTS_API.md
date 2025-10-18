# Points API Documentation

## Overview
The Points API handles point transactions for the Dinewell application. It manages point creation, tracking, and issuance through QR codes.

## Endpoints

### 1. Create Points Transaction
**POST** `/points`

Creates a new points transaction with pending status.

**Request Body:**
```json
{
  "restaurantId": 1,
  "customerId": 123, // optional
  "dishes": [
    {
      "name": "Pizza Margherita",
      "price": 15.99,
      "quantity": 2,
      "points": 320 // calculated automatically
    },
    {
      "name": "Custom Item",
      "price": 8.50,
      "quantity": 1,
      "points": 85
    }
  ],
  "totalPrice": 40.48,
  "pointsPerDollar": 10, // optional, defaults to 10
  "notes": "Special order" // optional
}
```

**Response:**
```json
{
  "success": true,
  "points": {
    "id": 1,
    "status": "pending",
    "restaurant_id": 1,
    "customer_id": null,
    "dishes": [...],
    "total_price": "40.48",
    "total_points": 405,
    "points_per_dollar": "10.00",
    "qr_code": "QR_abc123def456",
    "date_created": "2024-01-15T10:30:00Z",
    "date_issued": null,
    "notes": "Special order"
  },
  "message": "Points transaction created successfully"
}
```

### 2. Get Points by ID
**GET** `/points/:id`

Retrieves a specific points transaction.

**Response:**
```json
{
  "success": true,
  "points": {
    "id": 1,
    "status": "pending",
    "restaurant_id": 1,
    "customer_id": null,
    "dishes": [...],
    "total_price": "40.48",
    "total_points": 405,
    "qr_code": "QR_abc123def456",
    "date_created": "2024-01-15T10:30:00Z",
    "date_issued": null
  }
}
```

### 3. Update Points Transaction
**PUT** `/points/:id`

Updates a points transaction (status, customer_id, notes).

**Request Body:**
```json
{
  "status": "issued",
  "customerId": 123,
  "notes": "Points issued to customer"
}
```

### 4. Get Points by Restaurant
**GET** `/restaurants/:restaurantId/points`

Gets all points transactions for a restaurant.

**Query Parameters:**
- `status`: Filter by status (pending, issued)
- `limit`: Number of records to return (default: 50)
- `offset`: Number of records to skip (default: 0)

**Example:** `/restaurants/1/points?status=pending&limit=20&offset=0`

### 5. Get Points by QR Code
**GET** `/points/qr/:qrCode`

Retrieves a points transaction by its QR code.

**Example:** `/points/qr/QR_abc123def456`

### 6. Issue Points
**POST** `/points/:id/issue`

Issues points to a customer (changes status to 'issued').

**Request Body:**
```json
{
  "customerId": 123
}
```

### 7. Scan QR Code and Issue Points
**POST** `/points/scan/:qrCode`

Scans a QR code and issues points to a customer in one operation.

**Request Body:**
```json
{
  "customerId": 123
}
```

## Usage Examples

### Frontend Integration (React Native)

```javascript
// Create points transaction
const createPointsTransaction = async (orderData) => {
  try {
    const response = await fetch('/points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        restaurantId: user.id,
        dishes: orderData.items,
        totalPrice: orderData.totalPrice,
        pointsPerDollar: 10
      })
    });
    
    const result = await response.json();
    return result.points.qr_code; // Use this to generate QR code
  } catch (error) {
    console.error('Error creating points:', error);
  }
};

// Scan QR code and issue points
const scanQrCode = async (qrCode, customerId) => {
  try {
    const response = await fetch(`/points/scan/${qrCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: customerId
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error scanning QR code:', error);
  }
};
```

## Database Schema

The `points` table includes:
- `id`: Primary key
- `status`: 'pending' or 'issued'
- `restaurant_id`: Foreign key to user table
- `customer_id`: Foreign key to user table (nullable)
- `dishes`: JSONB array of dish objects
- `total_price`: Decimal total price
- `total_points`: Integer total points
- `points_per_dollar`: Decimal points per dollar rate
- `qr_code`: Unique QR code string
- `date_created`: Timestamp when created
- `date_issued`: Timestamp when issued (nullable)
- `notes`: Optional text notes
