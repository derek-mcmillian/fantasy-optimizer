// options.js
document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved key (but don't display it fully for security—show placeholder)
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (apiKey) {
        apiKeyInput.placeholder = 'Key saved (hidden for security)';
    }

    saveBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            status.textContent = 'Please enter a valid API key.';
            status.style.color = 'red';
            return;
        }

        try {
            await chrome.storage.sync.set({ apiKey: key });
            status.textContent = 'API key saved successfully!';
            status.style.color = 'green';
            apiKeyInput.value = ''; // Clear input after save
            apiKeyInput.placeholder = 'Key saved (hidden for security)';
        } catch (error) {
            status.textContent = 'Error saving key: ' + error.message;
            status.style.color = 'red';
        }
    });
});