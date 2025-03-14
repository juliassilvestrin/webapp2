# Universal Document Assistant

A secure document management system for storing, organizing, and tracking important documents like passports, visas, identification cards, and certificates.

## Deployed Application

- **Client**: [https://document-assistant.example.com](https://document-assistant.example.com)
- **Server**: [https://document-assistant-api.example.com](https://document-assistant-api.example.com)

## Project Description

Universal Document Assistant provides a centralized solution for managing important documents and keeping track of their expiration dates. It offers document storage with user authentication, expiration tracking, and an intuitive interface for managing various document types.

## Features

- User registration and authentication
- Document upload, storage, and management
- Document expiration tracking and status indicators
- Search and filter capabilities for documents
- Responsive design for desktop and mobile devices

## Technology Stack

- **Frontend**:
  - Vue.js 3 
  - HTML/CSS
  - Fetch API for AJAX requests

- **Backend**:
  - Node.js with Express
  - MongoDB 
  - Authentication with express-session
  - bcrypt for password hashing
  - Multer for file uploads

## Data Models/Schema

### User Model

```javascript
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minLength: 8
  }
}, {
  timestamps: true
});

//password hashing middleware
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
```

### Document Model

```javascript
const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['passport', 'visa', 'id', 'insurance', 'certificate', 'other']
  },
  expirationDate: {
    type: Date,
    default: null
  },
  issuingAuthority: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image', 'other'],
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});
```

## REST API Endpoints

### Authentication

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/users/register` | Register a new user | `{name, email, password}` | `{message: "User registered successfully"}` |
| POST | `/api/users/login` | Log in a user | `{email, password}` | `{message: "Login successful", user: {id, name, email}}` |
| POST | `/api/users/logout` | Log out a user | None | `{message: "Logged out successfully"}` |
| GET | `/api/users/me` | Get current user info | None | User object without password |

### Documents

| Method | Endpoint | Description | Request Body/Parameters | Response |
|--------|----------|-------------|------------------------|----------|
| GET | `/api/documents` | Get all user documents | None | Array of document objects |
| GET | `/api/documents/:id` | Get a specific document | `id` (path parameter) | Document object |
| POST | `/api/documents` | Create a new document | Form data with `name`, `type`, `expirationDate` (optional), `issuingAuthority` (optional), and `file` | Created document object |
| PUT | `/api/documents/:id` | Update a document | `id` (path parameter), Form data with fields to update | Updated document object |
| DELETE | `/api/documents/:id` | Delete a document | `id` (path parameter) | `{message: "Document deleted successfully"}` |



