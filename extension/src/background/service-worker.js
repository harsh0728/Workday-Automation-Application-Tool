chrome.runtime.onInstalled.addListener(() => {
  console.log("Workday AI Autofill installed");
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "WORKDAY_FIELDS_SCANNED") {
    console.log("Detected Workday fields:", message.fields);

    chrome.storage.local.set({
      workdayFields: message.fields
    });
  }
});