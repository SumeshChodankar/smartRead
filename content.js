// Log at initialization
console.log("Content script loaded successfully!");

const tasks = [];
let taskInProgress = false;
let hoverTimeout = null; // To track hover delay
let lastHoveredWord = null; // To avoid processing the same word repeatedly

// Task queue handler to process tasks sequentially
async function qTask(newTask) {
  if (newTask) tasks.push(newTask);
  if (tasks.length === 0 || taskInProgress) return;

  const nextTask = tasks.shift();
  taskInProgress = true;
  try {
    await nextTask();
  } finally {
    taskInProgress = false;
    setTimeout(qTask, 0); // Prevent stack overflow
  }
}

// Function to get the hovered word
function getHoveredWord(element, x, y) {
  console.log("Detecting hovered word...");
  const range = document.caretRangeFromPoint(x, y); // Get the text node at the pointer
  if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
    const text = range.startContainer.textContent.trim(); // Get the full text
    const words = text.split(/\s+/); // Split the text into words
    const offset = range.startOffset; // Find the character offset

    let charCount = 0;
    for (let word of words) {
      charCount += word.length + 1; // Add 1 for spaces
      if (offset < charCount) {
        console.log(`Hovered word detected: "${word}"`);
        return word;
      }
    }
  }
  return null;
}

// Function to display the definition in an overlay
function showOverlay(node, word, definition) {
  console.log(`Displaying overlay for word: "${word}"`);
  document.querySelectorAll(".hover-overlay").forEach((el) => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "hover-overlay";
  overlay.textContent = `${word}: ${definition}`;
  overlay.style.position = "absolute";

  // Calculate position relative to the hovered element
  const rect = node.getBoundingClientRect();
  overlay.style.top = `${window.scrollY + rect.top - 30}px`; // Adjust to display above the word
  overlay.style.left = `${window.scrollX + rect.left}px`;

  overlay.style.backgroundColor = "#f9f9f9";
  overlay.style.border = "1px solid #ccc";
  overlay.style.borderRadius = "5px";
  overlay.style.padding = "10px";
  overlay.style.zIndex = "10000";
  overlay.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
  document.body.appendChild(overlay);

  setTimeout(() => overlay.remove(), 5000); // Remove overlay after 5 seconds
}

// Function to fetch the definition from the background script
async function fetchDefinition(word) {
  console.log(`Fetching definition for word: "${word}"`);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "fetchDefinition", word: word }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error communicating with the background script:", chrome.runtime.lastError.message);
        reject("Error fetching definition.");
      } else if (response && response.success) {
        console.log(`Definition received: "${response.definition}"`);
        resolve(response.definition);
      } else {
        console.error("Error fetching definition:", response.error);
        reject("Error fetching definition.");
      }
    });
  });
}

// Function to handle mouseover events and queue tasks
function handleMouseOver(event) {
  clearTimeout(hoverTimeout); // Clear any existing timeout
  const hoveredWord = getHoveredWord(event.target, event.clientX, event.clientY);

  if (hoveredWord && hoveredWord !== lastHoveredWord) {
    hoverTimeout = setTimeout(() => {
      lastHoveredWord = hoveredWord; // Update the last processed word
      qTask(async () => {
        try {
          const definition = await fetchDefinition(hoveredWord).catch((error) => {
            console.error(error);
            return "Error fetching definition."; // Fallback definition
          });
          showOverlay(event.target, hoveredWord, definition); // Pass event.target (DOM element) here
        } catch (error) {
          console.error("Error in task:", error);
        }
      });
    }, 3000); // Process the word if hovered for 500ms
  }
}

// Attach the hover listener to the document
if (!window.hoverListenerAttached) {
  console.log("Attaching mouseover event listener...");
  document.body.addEventListener("mouseover", handleMouseOver);
  window.hoverListenerAttached = true; // Prevent duplicate listeners
}
