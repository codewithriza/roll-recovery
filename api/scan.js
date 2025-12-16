/**
 * Roll Recovery — Vercel Serverless API
 * /api/scan
 *
 * Vercel serverless functions can't do long-running SSE streams.
 * This endpoint accepts a single DOB attempt and returns whether it matched.
 * The frontend polls this in a loop instead of using SSE.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const TSBIE_URL = 'https://tgbieht.cgg.gov.in/SecondYrHallTickets.do';

module.exports = async (req, res) => {
  // CORS headers so the browser can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roll, dob } = req.body;

  if (!roll || !dob) {
    return res.status(400).json({ error: 'Missing roll or dob' });
  }

  try {
    const result = await tryDOB(roll, dob);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

async function tryDOB(roll, dobStr) {
  const body = new URLSearchParams();
  body.append('ssc_exam_no', roll);
  body.append('dob', dobStr);
  body.append('actionParameter', 'GetReport');
  body.append('passlineValueEncoded', '');
  body.append('submit', 'Get Hall Ticket');

  const bodyStr = body.toString();

  return new Promise((resolve, reject) => {
    const url = new URL(TSBIE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': TSBIE_URL,
        'Origin': 'https://tgbieht.cgg.gov.in',
        'Connection': 'keep-alive',
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 429) {
        return resolve({ success: false, rateLimited: true });
      }

      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve({ success: false, rateLimited: false });
      }

      const contentType = res.headers['content-type'] || '';
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const success = isMatch(text, contentType);
        resolve({
          success,
          rateLimited: false,
          html: success ? text : null,
          contentType: success ? contentType : null,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(bodyStr);
    req.end();
  });
}

function isMatch(html, contentType) {
  if (contentType && contentType.toLowerCase().includes('pdf')) return true;
  if (html.includes('Please enter valid Roll No. and Date of Birth')) return false;

  const keywords = ["FATHER'S", "MOTHER'S", 'CONTROLLER OF EXAMINATIONS', 'EXAMINATION CENTRE'];
  if (keywords.some((kw) => html.includes(kw))) return true;
  if (html.length > 50000) return true;

  return false;
}
