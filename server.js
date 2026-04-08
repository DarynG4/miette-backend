import "dotenv/config";
import app from "./app.js";

// when running locally there's no PORT environment variable set so process.env.PORT is undefined
// the || operator falls back to 8080 which is the local development port
// if 8080 was hardcoded the app would try to listen on 8080 but Render could route traffic to a different port entirely — the server would be unreachable in production
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Miette API is running on port ${PORT}!`);
});
