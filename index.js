import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { fetchAndSaveNews } from './fetcher.js';
import { News } from './models/News.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5005;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/naino_news_db';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for News Backend'))
  .catch((err) => console.error('MongoDB connection error:', err));

// API Endpoint to fetch latest news
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 }).limit(20);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Run cron job every 12 hours (at 00:00 and 12:00)
cron.schedule('0 0,12 * * *', () => {
  console.log('Running scheduled news fetch...');
  fetchAndSaveNews();
});

// Initial fetch on startup
setTimeout(() => {
  fetchAndSaveNews();
}, 5000);

app.listen(PORT, () => {
  console.log(`News Backend is running on port ${PORT}`);
});
