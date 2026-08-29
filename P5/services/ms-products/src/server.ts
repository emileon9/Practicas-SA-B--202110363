import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`ms-products escuchando en el puerto ${env.port}`);
});
