// options.js
document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const modelInput = document.getElementById('model');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Load saved settings (key is never displayed—show placeholder instead)
    let { apiKey, model } = await chrome.storage.sync.get(['apiKey', 'model']);
    if (apiKey) {
        apiKeyInput.placeholder = 'Key saved (hidden for security)';
    }
    if (model) modelInput.value = model;

    saveBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        const modelName = modelInput.value.trim();
        if (!key && !apiKey) {
            status.textContent = 'Please enter a valid API key.';
            status.style.color = 'red';
            return;
        }

        try {
            const updates = { model: modelName };
            if (key) updates.apiKey = apiKey = key; // blank key field keeps the saved key
            await chrome.storage.sync.set(updates);
            status.textContent = 'Settings saved!';
            status.style.color = 'green';
            apiKeyInput.value = '';
            apiKeyInput.placeholder = 'Key saved (hidden for security)';
        } catch (error) {
            status.textContent = 'Error saving settings: ' + error.message;
            status.style.color = 'red';
        }
    });
});
