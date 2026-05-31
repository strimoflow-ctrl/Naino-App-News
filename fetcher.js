import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import mongoose from 'mongoose';
import { News } from './models/News.js';

const parser = new Parser();

// Keywords to filter relevant education news
const KEYWORDS = ['NEET', 'JEE', 'CBSE', 'NCERT', 'NTA', 'Exam', 'Result'];

/**
 * Extracts a high-quality og:image and description from the article URL, handling Google News redirects
 */
const getArticleData = async (url) => {
  try {
    let response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    let $ = cheerio.load(response.data);
    
    // Check for meta refresh (Google News redirect)
    const refresh = $('meta[http-equiv="refresh"]').attr('content') || $('noscript').text();
    if (refresh && refresh.toLowerCase().includes('url=')) {
      const match = refresh.match(/url=(.*)/i);
      if (match && match[1]) {
        let redirectUrl = match[1].replace(/['"]/g, '').trim();
        // Fetch the actual article
        response = await axios.get(redirectUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        $ = cheerio.load(response.data);
      }
    }

    let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    
    let description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    if (!description) {
      description = $('p').first().text().trim().substring(0, 250);
      if (description) description += '...';
    }
    
    return { 
      ogImage: ogImage || null,
      description: description || 'Click to read the full article.'
    };
  } catch (error) {
    console.error(`Failed to fetch data for ${url}:`, error.message);
    return { ogImage: null, description: 'Click to read the full article.' };
  }
};

/**
 * Fetches news from Google News RSS, gets images, and saves to MongoDB
 */
export const fetchAndSaveNews = async () => {
  console.log('Starting automated news fetch via GitHub Actions...');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Google News RSS URL for Education in India
    const feed = await parser.parseURL('https://news.google.com/rss/search?q=NEET+OR+JEE+OR+CBSE+OR+NTA+education&hl=en-IN&gl=IN&ceid=IN:en');
    
    let savedCount = 0;
    
    // Process top items to get 1 valid one with good images
    for (const item of feed.items) {
      if (savedCount >= 1) break; // Only save 1 news per run
      
      // Check if already in DB
      const exists = await News.findOne({ link: item.link });
      if (exists) continue;
      
      console.log(`Processing: ${item.title}`);
      
      // Clean title (remove publisher name from the end e.g., " - NDTV")
      let cleanTitle = item.title;
      const lastDashIndex = cleanTitle.lastIndexOf(' - ');
      if (lastDashIndex !== -1) {
        cleanTitle = cleanTitle.substring(0, lastDashIndex);
      }
      
      // Get High Quality Image and Description from the actual article
      const { ogImage, description } = await getArticleData(item.link);
      
      if (ogImage) {
        const newsArticle = new News({
          title: cleanTitle,
          link: item.link,
          image: ogImage,
          description: description,
          source: item.source || 'Education News'
        });
        
        await newsArticle.save();
        console.log(`✅ Saved: ${cleanTitle}`);
        savedCount++;
      } else {
        console.log(`❌ Skipped (No Image found after resolving redirect): ${cleanTitle}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`Fetch complete. Saved ${savedCount} new articles.`);
  } catch (error) {
    console.error('Error during news fetch:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB. Exiting...');
    process.exit(0);
  }
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('fetcher.js')) {
  fetchAndSaveNews();
}
