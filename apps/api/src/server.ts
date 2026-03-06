import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  // Keep startup logging simple and deterministic.
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}`);
});
