import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Get current file path and directory for static serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware: parse incoming JSON request bodies
app.use(express.json());

// Serve static files from current directory (HTML, CSS, JS)
app.use(express.static(__dirname));

// Route: serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Route: serve results.html
app.get("/results.html", (req, res) => {
  res.sendFile(path.join(__dirname, "results.html"));
});

// Route: serve favicon.ico
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "favicon.ico"));
});

// Helper function: pause execution for given milliseconds
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// POST endpoint: accept DNA sequence and fetch BLAST results
app.post("/", async (req, res) => {
  try {
    const { sequence } = req.body;

    // Validate input
    if (!sequence) {
      return res.status(400).send("No sequence provided.");
    }

    // Step 1: Submit sequence to NCBI BLAST (PUT request)
    const putUrl = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Put&QUERY=${sequence}&DATABASE=core_nt&PROGRAM=blastn`;
    const putResponse = await fetch(putUrl);
    const putText = await putResponse.text();

    // Extract the Request ID (RID) from BLAST response
    const ridMatch = putText.match(/RID = ([A-Z0-9\-]+)/);
    if (!ridMatch) {
      return res.status(500).send("Failed to get RID from BLAST.");
    }

    const rid = ridMatch[1];
    console.log("RID:", rid);

    // Step 2: Poll BLAST until results are ready
    let blastResult = "";
    let attempts = 0;

    while (attempts < 10) {
      await sleep(5000); // wait 5 seconds before retrying

      // GET request to retrieve BLAST results
      const getUrl = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=Text`;
      const getResponse = await fetch(getUrl);
      blastResult = await getResponse.text();

      // Check if BLAST is still processing
      if (!blastResult.includes("Status=WAITING")) break;

      console.log("Results not ready yet, retrying...");
      attempts++;
    }

    // Log and send the final BLAST results
    console.log("BLAST Result:\n", blastResult);
    res.type("text").send(blastResult);

  } catch (error) {
    // Handle any errors in fetching or processing
    console.error(error);
    res.status(500).send("Error fetching BLAST results.");
  }
});

// Export the Express app for Vercel serverless functions
export default app;
