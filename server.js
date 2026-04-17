import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Miette API is running on port ${PORT}!`);
});
