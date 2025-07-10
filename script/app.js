let allTests = [];
let passedTests = [];
let failedTests = [];
let slowTests = [];
const fileInput = document.getElementById('fileInput');
const jsonUploadArea = document.getElementById('jsonUploadArea');
const reportContainer = document.getElementById('reportContainer');
const failurePanel = document.getElementById('failurePanel');
const viewFailedBtn = document.getElementById('viewFailedBtn');

// Initialize Bootstrap tabs
const resultsTab = new bootstrap.Tab(document.getElementById('all-tab'));

// Pretty print JSON function

function prettyPrintJson(json) {
    try {
        if (typeof json === 'string') {
            json = JSON.parse(json);
        }
        return JSON.stringify(json, null, 2);
    } catch (e) {
        return json;
    }
}

function toggleVisibility(elementId, iconElement = null) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const isHidden = element.style.display === 'none';
    if (isHidden) {
        element.style.display = '';
        if (iconElement) {
            iconElement.classList.remove('fa-eye');
            iconElement.classList.add('fa-eye-slash');
            iconElement.parentElement.setAttribute('title', 'Hide endpoint');
        }
    } else {
        element.style.display = 'none';
        if (iconElement) {
            iconElement.classList.remove('fa-eye-slash');
            iconElement.classList.add('fa-eye');
            iconElement.parentElement.setAttribute('title', 'Show endpoint');
        }
    }
}

function toggleResponseBody(button) {
    const container = button.nextElementSibling;
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    button.innerHTML = isHidden 
        ? '<i class="fas fa-code me-2"></i>Hide Response Body' 
        : '<i class="fas fa-code me-2"></i>Show Response Body';
}

function renderTests(filtered, containerId) {
    const resultsEl = document.getElementById(containerId);
    if (!resultsEl) return;
    
    if (filtered.length === 0) {
        resultsEl.innerHTML = '<div class="alert alert-info text-center">No tests match the current filter.</div>';
        return;
    }

    resultsEl.innerHTML = filtered.map((item, index) => {
        const hasFailed = item.assertions.some(a => a.status === 'failed');
        const statusClass = hasFailed ? 'failed' : 'passed';
        const statusText = hasFailed ? 'FAIL' : 'PASS';

        return `
        <div class="test-card ${statusClass}">
            <div class="d-flex justify-content-between align-items-center">
                <div class="test-name">${item.name}</div>
                <div class="test-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="endpoint d-flex align-items-center mt-2">
                <strong class="me-2">${item.method}</strong>
                <span id="${containerId}-url-${index}" class="flex-grow-1">${item.url}</span>
                <button class="btn btn-sm p-0 ms-2 btn-toggle-visibility" onclick="toggleVisibility('${containerId}-url-${index}', this.querySelector('i'))" title="Hide endpoint">
                    <i class="fas fa-eye-slash"></i>
                </button>
            </div>

            <div class="small mt-1">
                <strong>Response:</strong>
                <span class="text-muted">${item.responseCode} ${item.responseStatus} | Time: ${item.time}ms</span>
            </div>

            <div class="mt-3">
                ${(item.assertions.length > 0) ? item.assertions.map(assertion => `
                <div class="assertion ${assertion.status}">
                    <div class="d-flex justify-content-between">
                        <span>${assertion.name}</span>
                        <strong>${assertion.status.toUpperCase()}</strong>
                    </div>
                </div>`).join('') : '<div class="alert alert-secondary p-2">No assertions found for this request.</div>'}
            </div>

            ${hasFailed && item.responseBody ? `
            <div class="mt-2">
                <button class="btn btn-outline-secondary btn-sm" onclick="toggleResponseBody(this)">
                    <i class="fas fa-code me-2"></i>Show Response Body
                </button>
                <div style="display:none;" class="response-body-container p-2 mt-1 rounded border">
                    <pre class="mb-0"><code>${prettyPrintJson(item.responseBody)}</code></pre>
                </div>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

function calculateStatus(passed, failed) {
  const total = passed + failed;
  if (total === 0) return { status: 'NO DATA', severity: 'muted' };
  if (failed === 0) return { status: 'PASS', severity: 'success' };
  
  const failureRate = (failed / total) * 100;
  
  if (failureRate < 5) return { status: 'WARNING', severity: 'warning' };
  if (failureRate < 20) return { status: 'FAIL', severity: 'danger' };
  return { status: 'CRITICAL', severity: 'critical' };
}

function renderReport(data) {
    const results = data.results || (data.run && data.run.executions) || [];

    if (results.length === 0) {
        alert('Could not find test results in the provided JSON. Please provide a valid Postman run report.');
        return;
    }
      const collection = data.collection || {};
    
    document.getElementById('reportTitle').textContent = data.name || data.collection?.info?.name || 'Postman Test Report';

    allTests = results.map(result => {
        const assertionsRaw = result.assertions || result.tests || {};
        const assertions = Array.isArray(assertionsRaw)
            ? assertionsRaw.map(a => ({ 
                name: a.assertion || a.name || 'Unnamed assertion', 
                status: a.error ? 'failed' : 'passed' 
              }))
            : Object.entries(assertionsRaw).map(([key, value]) => ({ 
                name: key, 
                status: value ? 'passed' : 'failed' 
              }));

        const request = result.request || {};
        const response = result.response || {};
        
// ****************************
//         let method = (request.method || result.method || 'GET').toString().trim().toUpperCase();
// if (method === 'REQUEST URL:') method = 'GET';

// Determine method using collection reference if available, else fallback to 'ENDPOINT'
let method = 'ENDPOINT';
if (collection?.requests?.length) {
    const match = collection.requests.find(req => req.id === result.id);
    method = match?.method?.toUpperCase() || 
             (request.method || result.method || 'ENDPOINT').toString().trim().toUpperCase();
} else {
    method = (request.method || result.method || 'ENDPOINT').toString().trim().toUpperCase();
}
if (method === 'REQUEST URL:') method = 'ENDPOINT';
// **********************************

        return {
            name: result.name || request.name || 'Unnamed Request',
            url: request.url?.toString() || result.url || '',
            method: method,
            time: response.responseTime || result.time || 0,
            responseCode: response.code || result.responseCode?.code || 'N/A',
            responseStatus: response.status || result.responseCode?.name || '',
            assertions: assertions,
            responseBody: response.body || result.responseBody || response.stream || ''
        };
    });

    // Filter tests
    passedTests = allTests.filter(t => !t.assertions.some(a => a.status === 'failed'));
    failedTests = allTests.filter(t => t.assertions.some(a => a.status === 'failed'));
    slowTests = allTests.filter(t => t.time > 500);

    // Calculate metrics
    const totalTests = allTests.length;
    const totalAssertions = allTests.reduce((sum, test) => sum + test.assertions.length, 0);
    const failedAssertions = allTests.reduce((sum, test) => sum + test.assertions.filter(a => a.status === 'failed').length, 0);
    const passedAssertions = totalAssertions - failedAssertions;
    const totalTime = allTests.reduce((sum, r) => sum + r.time, 0);
    const avgTime = totalTests > 0 ? (totalTime / totalTests).toFixed(0) : 0;
    
    // Calculate percentages
    const passedPercentage = totalAssertions > 0 ? ((passedAssertions / totalAssertions) * 100).toFixed(1) : 0;
    const failedPercentage = totalAssertions > 0 ? ((failedAssertions / totalAssertions) * 100).toFixed(1) : 0;
    
    // Calculate status
    const status = calculateStatus(passedAssertions, failedAssertions);

    // Find fastest and slowest tests
    const fastestTest = allTests.length > 0 ? 
        Math.min(...allTests.map(t => t.time)) : 0;
    const slowestTest = allTests.length > 0 ? 
        Math.max(...allTests.map(t => t.time)) : 0;

    // Update UI
    document.getElementById('totalTests').textContent = totalTests;
    document.getElementById('totalAssertions').textContent = totalAssertions;
    document.getElementById('passedTests').innerHTML = `${passedAssertions} <small>(${passedPercentage}%)</small>`;
    document.getElementById('failedTests').innerHTML = `${failedAssertions} <small>(${failedPercentage}%)</small>`;
    document.getElementById('executionTime').textContent = `${(totalTime / 1000).toFixed(2)}s`;
    document.getElementById('avgTime').textContent = `${avgTime}ms`;
    document.getElementById('fastestTest').textContent = `${fastestTest}ms`;
    document.getElementById('slowestTest').textContent = `${slowestTest}ms`;
    
    // Update KPI cards
    document.getElementById('totalRequests').textContent = totalTests;
    document.getElementById('successRate').textContent = `${passedPercentage}%`;
    document.getElementById('failedTestsCount').textContent = failedTests.length;
    document.getElementById('avgResponseTime').textContent = `${avgTime}ms`;

    // Update failure panel
    if (failedTests.length > 0) {
        failurePanel.style.display = 'block';
        document.getElementById('failureCount').textContent = 
            `${failedTests.length} test${failedTests.length > 1 ? 's' : ''} failed (${failedPercentage}% failure rate)`;
    } else {
        failurePanel.style.display = 'none';
    }

    // Render all test tabs
    renderTests(allTests, 'testResultsAll');
    renderTests(passedTests, 'testResultsPassed');
    renderTests(failedTests, 'testResultsFailed');
    renderTests(slowTests, 'testResultsSlow');

    // Initialize charts
    initCharts();
    
    // Show the report and hide the upload area
    reportContainer.style.display = 'block';
    jsonUploadArea.style.display = 'none';
}

function initCharts() {
    try {
        // Response Time Chart
        const responseTimeCtx = document.getElementById('responseTimeChart');
        if (responseTimeCtx) {
            new Chart(responseTimeCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: allTests.map((_, i) => `Test ${i+1}`),
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: allTests.map(test => test.time),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderWidth: 1,
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Important for fixed size
                    aspectRatio: 2, // Width to height ratio
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Response Time (ms)'
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 10
                            },
                            title: {
                                display: true,
                                text: 'Test Sequence'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    }
                }
            });
        }

        // Status Code Chart
        const statusCodeCtx = document.getElementById('statusCodeChart');
        if (statusCodeCtx) {
            const statusCodes = {};
            allTests.forEach(test => {
                const code = test.responseCode;
                statusCodes[code] = (statusCodes[code] || 0) + 1;
            });

            const backgroundColors = [
                'rgba(54, 162, 235, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(153, 102, 255, 0.7)',
                'rgba(255, 159, 64, 0.7)'
            ];

            new Chart(statusCodeCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Object.keys(statusCodes),
                    datasets: [{
                        label: 'Count',
                        data: Object.values(statusCodes),
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Important for fixed size
                    aspectRatio: 2, // Width to height ratio
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Request Count'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Status Code'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

function handleFile(file) {
    if (!file || !file.type.includes('json')) {
        alert('Please upload a valid JSON file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const json = JSON.parse(event.target.result);
            renderReport(json);
        } catch (e) {
            alert('Error parsing JSON file. Please ensure it is well-formed.');
            console.error("JSON Parse Error:", e);
        }
    };
    reader.readAsText(file);
}

// Event Listeners
jsonUploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

jsonUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    jsonUploadArea.classList.add('dragover');
});

jsonUploadArea.addEventListener('dragleave', () => {
    jsonUploadArea.classList.remove('dragover');
});

jsonUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    jsonUploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

document.getElementById('pasteJsonBtn').addEventListener('click', () => {
    const pastedData = prompt('Paste your Postman JSON report data here:');
    if (pastedData) {
        try {
            const json = JSON.parse(pastedData);
            renderReport(json);
        } catch (e) {
            alert('Invalid JSON data pasted.');
            console.error("JSON Paste Error:", e);
        }
    }
});

viewFailedBtn.addEventListener('click', () => {
    const failedTab = new bootstrap.Tab(document.getElementById('failed-tab'));
    failedTab.show();
});

// Theme switching function
function switchTheme(theme) {
  const html = document.documentElement;
  const lightBtn = document.querySelector('.theme-btn[onclick*="light"]');
  const darkBtn = document.querySelector('.theme-btn[onclick*="dark"]');
  
  // Remove all theme classes first
  html.classList.remove('light-theme', 'dark-theme');
  
  if (theme === 'dark') {
    html.classList.add('dark-theme');
    html.setAttribute('data-theme', 'dark');
    lightBtn?.classList.remove('active');
    darkBtn?.classList.add('active');
    localStorage.setItem('theme', 'dark');
  } else {
    html.classList.add('light-theme');
    html.removeAttribute('data-theme');
    darkBtn?.classList.remove('active');
    lightBtn?.classList.add('active');
    localStorage.setItem('theme', 'light');
  }
}

// Initialize theme on load
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Check for saved theme first, then system preference
  const themeToSet = savedTheme || (prefersDark ? 'dark' : 'light');
  switchTheme(themeToSet);
}

// Call this when page loads
document.addEventListener('DOMContentLoaded', initializeTheme);

// Watch for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    switchTheme(e.matches ? 'dark' : 'light');
  }
});


// Fail test redirect
function animatedScrollTo(targetY, duration = 600) {
    const startY = window.pageYOffset;
    const distanceY = targetY - startY;
    let startTime = null;

    function easeInOutQuad(t) {
      return t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t;
    }

    function scroll(currentTime) {
      if (!startTime) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutQuad(progress);
      window.scrollTo(0, startY + distanceY * ease);

      if (progress < 1) {
        requestAnimationFrame(scroll);
      }
    }

    requestAnimationFrame(scroll);
  }

  document.getElementById("viewFailedBtn").addEventListener("click", function () {
    const failedTab = document.getElementById("failed-tab");
    const offsetTop = failedTab.getBoundingClientRect().top + window.pageYOffset - 100; // Adjust offset if needed

    // Smooth scroll to the failed tab button
    animatedScrollTo(offsetTop, 700); // scroll duration = 700ms

    // Activate the tab after short delay (can be instant too)
    setTimeout(() => {
      failedTab.click();
    }, 750); // Match or slightly exceed scroll duration
  });

