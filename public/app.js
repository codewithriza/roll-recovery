const $ = (id) => document.getElementById(id);
const scanForm = $('scanForm');
const startBtn = $('startBtn');
let eventSource = null;
let scanRunning = false;

scanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const roll = $('roll').value.trim();
  const startDate = $('startDate').value;
  const endDate = $('endDate').value;
  if (!roll) return;
  
  const params = new URLSearchParams({ roll, startDate, endDate, delay: 100 });
  eventSource = new EventSource('/api/scan?' + params);
  
  eventSource.addEventListener('attempt', (e) => {
    const d = JSON.parse(e.data);
    console.log('Testing', d.dob);
  });
  
  eventSource.addEventListener('found', (e) => {
    const d = JSON.parse(e.data);
    console.log('Found!', d.dob);
    eventSource.close();
  });
  
  eventSource.addEventListener('done', () => {
    eventSource.close();
  });
});
