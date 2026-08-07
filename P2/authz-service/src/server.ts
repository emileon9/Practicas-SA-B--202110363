import app from "./app";
import { env } from "./env";

app.listen(env.port, () => {
    console.log(`Microservicio de autorizacion escuchando en http://localhost:${env.port}`);
});