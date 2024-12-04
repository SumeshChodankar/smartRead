console.log("Background script loaded successfully!");

const tasks = [];
let taskInProgress = false;

// Task queue handler
async function qTask(newTask) {
  if (newTask) tasks.push(newTask);
  if (tasks.length === 0 || taskInProgress) return;

  const nextTask = tasks.shift();
  taskInProgress = true;
  try {
    await nextTask();
  } catch (error) {
    console.error("Error processing task:", error);
  } finally {
    taskInProgress = false;
    setTimeout(qTask, 0); // Prevent stack overflow
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchDefinition") {
    qTask(async () => {
      try {
        console.log(`Received word "${message.word}" for definition lookup...`);

        // Check if the AI model is available
        const { available } = await ai.languageModel.capabilities();
        if (available === "no") {
          console.error("AI model not available.");
          sendResponse({ success: false, error: "AI model not available. Please ensure the model is enabled." });
          return;
        }

        console.log("AI model is available. Creating a session...");
        const session = await ai.languageModel.create({
          systemPrompt: "You are a helpful assistant that provides concise definitions of words.",
        });

        console.log("Session created. Fetching definition...");
        const result = await session.prompt(`Define the word: ${message.word}`);
        console.log(`Definition fetched successfully: "${result}"`);

        sendResponse({ success: true, definition: result });

        // Destroy the session to free resources
        session.destroy();
      } catch (error) {
        console.error("Error fetching definition:", error);
        sendResponse({ success: false, error: error.message });
      }
    });
  } else {
    console.warn("Unknown action received:", message.action);
    sendResponse({ success: false, error: "Unknown action" });
  }

  return true; // Keep the message port open for async responses
});
