import * as pdfjsLib from "../../vendor/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  chrome.runtime.getURL("vendor/pdf.worker.min.mjs");

const fileInput = document.getElementById("resumeFile");
const parseBtn = document.getElementById("parseBtn");
const status = document.getElementById("status");
const output = document.getElementById("output");

const mapBtn = document.getElementById("mapBtn");
const mappingOutput = document.getElementById("mappingOutput");

const autofillBtn = document.getElementById("autofillBtn");
const autofillOutput = document.getElementById("autofillOutput");

const BACKEND_URL = "http://localhost:3000";

let parsedResumeData = null;


// ===============================
// PROFILE LINK IDENTIFICATION
// ===============================

function identifyLink(url) {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("linkedin.com")) {
    return "linkedin";
  }

  if (lowerUrl.includes("github.com")) {
    return "github";
  }

  if (lowerUrl.includes("leetcode.com")) {
    return "leetcode";
  }

  if (
    lowerUrl.includes("geeksforgeeks.org") ||
    lowerUrl.includes("geeksforgeeks.com")
  ) {
    return "geeksforgeeks";
  }

  return null;
}


// ===============================
// MILESTONE 3 - RESUME PARSING
// ===============================

parseBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    status.textContent = "Please select a PDF resume.";
    return;
  }

  if (file.type !== "application/pdf") {
    status.textContent = "Milestone 3 currently supports PDF only.";
    return;
  }

  try {
    status.textContent = "Extracting resume...";

    // 1. Read PDF
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

    let resumeText = "";
    const links = [];

    // 2. Extract text and links
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);

      // Extract text
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => item.str)
        .join(" ");

      resumeText += pageText + "\n";

      // Extract clickable links
      const annotations = await page.getAnnotations();

      for (const annotation of annotations) {
        if (
          annotation.subtype === "Link" &&
          annotation.url
        ) {
          links.push(annotation.url);
        }
      }
    }

    // 3. Identify profile links
    const profiles = {
      linkedin: "",
      github: "",
      leetcode: "",
      geeksforgeeks: ""
    };

    for (const url of links) {
      const type = identifyLink(url);

      if (type && !profiles[type]) {
        profiles[type] = url;
      }
    }

    console.log("Resume text:", resumeText);
    console.log("Resume links:", links);
    console.log("Profiles:", profiles);

    // 4. Send to Gemini backend
    status.textContent = "Analyzing resume with Gemini...";

    const response = await fetch(
      `${BACKEND_URL}/api/parse-resume`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resumeText,
          links,
          profiles
        })
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        errorData.error ||
        `Backend returned ${response.status}`
      );
    }

    // 5. Receive parsed resume
    const result = await response.json();

    parsedResumeData = result.resumeData;

    // 6. Display parsed resume
    status.textContent =
      "Resume parsed successfully.";

    output.textContent = JSON.stringify(
      parsedResumeData,
      null,
      2
    );

    console.log(
      "Gemini Resume JSON:",
      result.resumeData
    );

  } catch (error) {
    console.error(
      "Resume parsing error:",
      error
    );

    status.textContent =
      "Failed to parse resume.";

    output.textContent = JSON.stringify(
      {
        error: error.message
      },
      null,
      2
    );
  }
});


// ===============================
// MILESTONE 4 - AI FIELD MAPPING
// ===============================

mapBtn.addEventListener("click", async () => {
  if (!parsedResumeData) {
    status.textContent =
      "Parse the resume first.";
    return;
  }

  status.textContent =
    "Getting Workday fields...";

  try {
    // Get scanned Workday fields
    const stored = await chrome.storage.local.get(
      "workdayFields"
    );

    const fields =
      stored.workdayFields || [];

    if (!fields.length) {
      status.textContent =
        "No Workday fields detected.";
      return;
    }

    status.textContent =
      "Mapping fields with Gemini...";

    // Send fields + resume to backend
    const response = await fetch(
      `${BACKEND_URL}/api/map-fields`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resumeData: parsedResumeData,
          fields
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        "Field mapping failed"
      );
    }

    // Receive mappings
    const result = await response.json();

    // IMPORTANT:
    // Save mappings for Milestone 5
    await chrome.storage.local.set({
      fieldMappings: result.mappings || []
    });

    // Display mappings
    mappingOutput.textContent =
      JSON.stringify(
        result,
        null,
        2
      );

    status.textContent =
      "Fields mapped successfully.";

  } catch (error) {
    console.error(
      "Field mapping error:",
      error
    );

    status.textContent =
      "Failed to map fields.";
  }
});


// ===============================
// MILESTONE 5 - AUTOFILL
// ===============================

autofillBtn.addEventListener(
  "click",
  async () => {
    try {
      status.textContent =
        "Starting autofill...";

      // Get active Workday tab
      const [tab] =
        await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

      if (!tab?.id) {
        throw new Error(
          "No active tab found."
        );
      }

      // Get saved mappings
      const stored =
        await chrome.storage.local.get(
          "fieldMappings"
        );

      const mappings =
        stored.fieldMappings || [];

      if (!mappings.length) {
        autofillOutput.textContent =
          "No mappings available. Map fields first.";

        status.textContent =
          "No mappings available.";

        return;
      }

      // Send mappings to Workday content script
      const result =
        await chrome.tabs.sendMessage(
          tab.id,
          {
            type: "WORKDAY_AUTOFILL",
            mappings
          }
        );

      // Display autofill result
      autofillOutput.textContent =
        JSON.stringify(
          result,
          null,
          2
        );

      status.textContent =
        "Autofill completed.";

    } catch (error) {
      console.error(
        "Autofill error:",
        error
      );

      autofillOutput.textContent =
        JSON.stringify(
          {
            error: error.message
          },
          null,
          2
        );

      status.textContent =
        "Autofill failed. Refresh the Workday page and try again.";
    }
  }
);