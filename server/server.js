const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { User, Document } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    // headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'null');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');

    // preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
    secret: 'document_assistant_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, //24 hours
        sameSite: 'none',
        secure: false
    }
}));

// create uploads directory if it doesn't exist!!!!
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//multer stuff
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const fileFilter = function (req, file, cb) {
    console.log('Uploaded file:', file);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
        console.log('File type not allowed:', file.mimetype);
        return cb(new Error('Only PDF and image files are allowed'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5mb limit 
    fileFilter: fileFilter
});

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        console.log('User authenticated via session:', req.session.userId);
        return next();
    }


    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); //remove bearer name
        console.log('User authenticated via token:', token);
        req.session.userId = token;
        return next();
    }


    console.log('Authentication failed: No valid session or token');
    return res.status(401).json({ message: 'Not authenticated' });
}

//multer error handling
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ message: err.message });
    }
    next();
}


// API test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working properly' });
});

//user routes
app.post('/api/users/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        console.log('Registration attempt:', { name, email, passwordLength: password ? password.length : 0 });


        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        console.log('User registered successfully');
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

//login sutff
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });


        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }


        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password does not match for user:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }


        req.session.userId = user._id;
        console.log('Login successful for user:', email, 'User ID in session:', req.session.userId);

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

//logout
app.post('/api/users/logout', (req, res) => {
    const userId = req.session.userId;
    console.log('Logout attempt for user ID:', userId);

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Error logging out' });
        }
        console.log('Logout successful for user ID:', userId);
        res.json({ message: 'Logged out successfully' });
    });
});

//get user info
app.get('/api/users/me', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('Getting user info for ID:', userId);

        const user = await User.findById(userId).select('-password');
        if (!user) {
            console.log('User not found for ID:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


//gey all documents
app.get('/api/documents', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('Getting documents for user ID:', userId);

        const documents = await Document.find({ user: userId }).sort({ createdAt: -1 });
        console.log(`Found ${documents.length} documents for user ID:`, userId);

        res.json(documents);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

//get a single document
app.get('/api/documents/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const documentId = req.params.id;
        console.log(`Getting document ${documentId} for user ID:`, userId);

        const document = await Document.findOne({
            _id: documentId,
            user: userId
        });

        if (!document) {
            console.log(`Document ${documentId} not found for user ID:`, userId);
            return res.status(404).json({ message: 'Document not found' });
        }

        res.json(document);
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


app.post('/api/documents', isAuthenticated, upload.single('file'), handleMulterError, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('Creating document for user ID:', userId);
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        if (!req.file) {
            console.log('Error: No file uploaded');
            return res.status(400).json({ message: 'No file uploaded' });
        }


        if (!req.body.name) {
            console.log('Error: Document name is required');
            return res.status(400).json({ message: 'Document name is required' });
        }

        if (!req.body.type) {
            console.log('Error: Document type is required');
            return res.status(400).json({ message: 'Document type is required' });
        }

        // file type
        let fileType = 'other';
        if (req.file.mimetype === 'application/pdf') {
            fileType = 'pdf';
        } else if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        }

        const document = new Document({
            name: req.body.name,
            type: req.body.type,
            expirationDate: req.body.expirationDate || null,
            issuingAuthority: req.body.issuingAuthority,
            fileName: req.file.originalname,
            fileType: fileType,
            filePath: req.file.path,
            user: userId
        });

        await document.save();
        console.log(`Document created successfully with ID: ${document._id} for user ID:`, userId);

        res.status(201).json(document);
    } catch (error) {
        console.error('Create document error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


app.put('/api/documents/:id', isAuthenticated, upload.single('file'), handleMulterError, async (req, res) => {
    try {
        const userId = req.session.userId;
        const documentId = req.params.id;
        console.log(`Updating document ${documentId} for user ID:`, userId);
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);

        const document = await Document.findOne({
            _id: documentId,
            user: userId
        });

        if (!document) {
            console.log(`Document ${documentId} not found for user ID:`, userId);
            return res.status(404).json({ message: 'Document not found' });
        }


        if (!req.body.name) {
            console.log('Error: Document name is required');
            return res.status(400).json({ message: 'Document name is required' });
        }

        if (!req.body.type) {
            console.log('Error: Document type is required');
            return res.status(400).json({ message: 'Document type is required' });
        }


        document.name = req.body.name;
        document.type = req.body.type;
        document.expirationDate = req.body.expirationDate || document.expirationDate;
        document.issuingAuthority = req.body.issuingAuthority || document.issuingAuthority;


        if (req.file) {
            //remove old file
            if (fs.existsSync(document.filePath)) {
                fs.unlinkSync(document.filePath);
            }


            let fileType = 'other';
            if (req.file.mimetype === 'application/pdf') {
                fileType = 'pdf';
            } else if (req.file.mimetype.startsWith('image/')) {
                fileType = 'image';
            }

            document.fileName = req.file.originalname;
            document.fileType = fileType;
            document.filePath = req.file.path;
        }

        await document.save();
        console.log(`Document ${documentId} updated successfully for user ID:`, userId);

        res.json(document);
    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


app.delete('/api/documents/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const documentId = req.params.id;
        console.log(`Deleting document ${documentId} for user ID:`, userId);

        const document = await Document.findOne({
            _id: documentId,
            user: userId
        });

        if (!document) {
            console.log(`Document ${documentId} not found for user ID:`, userId);
            return res.status(404).json({ message: 'Document not found' });
        }


        if (fs.existsSync(document.filePath)) {
            fs.unlinkSync(document.filePath);
        }

        await Document.deleteOne({ _id: documentId });
        console.log(`Document ${documentId} deleted successfully for user ID:`, userId);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/documents/:id/file', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const documentId = req.params.id;
        console.log(`Getting file for document ${documentId} for user ID:`, userId);

        const document = await Document.findOne({
            _id: documentId,
            user: userId
        });

        if (!document) {
            console.log(`Document ${documentId} not found for user ID:`, userId);
            return res.status(404).json({ message: 'Document not found' });
        }

        if (!fs.existsSync(document.filePath)) {
            console.log(`File not found at path: ${document.filePath} for document ${documentId}`);
            return res.status(404).json({ message: 'File not found' });
        }

        res.sendFile(path.resolve(document.filePath));
    } catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


app.use(express.static(path.join(__dirname, '../public')));


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
});

//start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});