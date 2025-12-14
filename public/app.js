const scanForm = document.getElementById('scanForm');
scanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  console.log('Scan started');
});
