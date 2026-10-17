// DEBE ser el primer import: inicializa OpenTelemetry antes de que
// cualquier otro modulo (incluido express, importado dentro de "./app")
// se cargue. Ver el comentario de cabecera de observability/tracing.ts.
import "./observability/tracing";
import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Gateway escuchando en el puerto ${env.port}`);
});
