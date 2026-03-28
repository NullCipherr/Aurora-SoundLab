import { createApp } from "./app.js";

const port = Number(process.env.PORT || 4000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`Aurora SoundLab API running on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Porta ${port} em uso. Encerre o processo atual ou rode com outra porta (ex.: PORT=4001 npm run dev -w server).`
    );
    process.exit(1);
  }

  throw error;
});
