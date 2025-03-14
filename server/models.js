const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// connect to mongodb
mongoose.connect('mongodb+srv://Julia123:Julia123@cluster0.mq3mh.mongodb.net/users', {})
    .then(() => console.log('MongoDB connected to users database'))
    .catch(err => console.error('MongoDB connection error:', err));

//user model
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

//hash passowrd before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});


const documentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
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
        type: String
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
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Document = mongoose.model('Document', documentSchema);

module.exports = {
    User,
    Document
};