import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { News } from './models/News.js';

const parser = new Parser();

// Keywords to filter relevant education news
const KEYWORDS = ['NEET', 'JEE', 'CBSE', 'NCERT', 'NTA', 'Exam', 'Result'];

/**
 * Extracts a high-quality og:image from the article URL
 */
const getOgImage = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    let ogImage = $('meta[property="og:image"]').attr('content');
    
    // Fallback to twitter:image
    if (!ogImage) {
      ogImage = $('meta[name="twitter:image"]').attr('content');
    }
    
    return ogImage || null;
  } catch (error) {
    console.error(`Failed to fetch image for ${url}:`, error.message);
    return null;
  }
};

/**
 * Fetches news from Google News RSS, gets images, and saves to MongoDB
 */
export const fetchAndSaveNews = async () => {
  console.log('Starting automated news fetch...');
  try {
    // Google News RSS URL for Education in India
    const feed = await parser.parseURL('https://news.google.com/rss/search?q=NEET+OR+JEE+OR+CBSE+OR+NTA+education&hl=en-IN&gl=IN&ceid=IN:en');
    
    let savedCount = 0;
    
    // Process top 10 items to try to get 2 valid ones with good images
    for (const item of feed.items.slice(0, 10)) {
      if (savedCount >= 2) break; // Only save top 2 news per run
      
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
      
      // Get High Quality Image from the actual article
      const imageUrl = await getOgImage(item.link);
      
      if (imageUrl) {
        const newsArticle = new News({
          title: cleanTitle,
          link: item.link,
          image: imageUrl,
          source: item.source || 'Google News'
        });
        
        await newsArticle.save();
        console.log(`✅ Saved: ${cleanTitle}`);
        savedCount++;
      } else {
        console.log(`❌ Skipped (No Image): ${cleanTitle}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`Fetch complete. Saved ${savedCount} new articles.`);
  } catch (error) {
    console.error('Error during news fetch:', error);
  }
};
