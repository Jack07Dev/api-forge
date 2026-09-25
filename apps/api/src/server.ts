import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

const startServer = async (): Promise<void> => {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(
      `API Platform server running on http://localhost:${env.port}`
    );
  });
};

startServer();