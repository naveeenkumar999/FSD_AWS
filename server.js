const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');

dotenv.config();
var corOptions ={origin:true}
// Set up Express server
const app = express();
const port = process.env.PORT;

// Middleware
app.use(cors(corOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.log(error));

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Define MongoDB schema and model
const imageSchema = new mongoose.Schema({
  url: String,
  category: String,
});

const Image = mongoose.model('Image', imageSchema);

// Routes
app.get('/', (req, res) => {
    res.send('Hello, world server launched!');
});

// Example route with JWT authentication
app.post('/login', (req, res) => {
  const { username } = req.body;

  // Authenticate user here (e.g., check username/password against database)

  // If authentication is successful, create a JWT token
  const token = jwt.sign({ username }, process.env.JWT_SECRET);

  res.json({ token });
});

// Fetch all images from the Amazon S3 bucket
app.get('/images/all', async (req, res) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
  };

  try {
    const data = await s3Client.send(new ListObjectsCommand(params));
    const images = data.Contents.map((item) => item.Key);
    res.json({ images });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Upload image to the Amazon S3 bucket and save to MongoDB
const upload = multer({ dest: 'uploads/' }); // Destination folder for uploaded files

app.post('/upload/image', upload.single('image'), async (req, res) => {
  const { filename, path } = req.file;
  const { category } = req.body;

  // Check if the uploaded file is an image with allowed extensions
  const allowedMimeTypes = ['image/jpeg', 'image/png'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only JPEG and PNG image files are allowed' })}

  try {
    const data = await fs.promises.readFile(path);
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      Body: data,
    };
    await s3Client.send(new PutObjectCommand(params));

    // Save image URL and category to MongoDB
    const image = new Image({
      url: filename,
      category,
    });
    await image.save();

    await fs.promises.unlink(path); // Delete the temporary uploaded file

    res.json({ message: 'Image uploaded successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error:'Failed to upload the image'})
  }})
  // Start the server
app.listen(port, () => {
  console.log("server is running")})

