import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    required: true,
    unique: true, // Prevent duplicate news articles
  },
  description: {
    type: String,
    default: '',
  },
  source: {
    type: String,
    default: 'Google News',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Automatically delete after 30 days
  }
});

export const News = mongoose.model('News', newsSchema);
