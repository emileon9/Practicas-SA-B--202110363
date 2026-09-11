import request from "supertest";
import app from "../src/app";
import { createServiceProxy } from "../src/services/proxy.service";

describe("GET /health", () => {
  it("responde 200 con el nombre del servicio", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "gateway" });
  });
});

describe("proxy.service", () => {
  it("createServiceProxy produce un middleware de Express valido", () => {
    const middleware = createServiceProxy("http://localhost:4001");
    expect(typeof middleware).toBe("function");
  });
});

describe("GET /api/no-existe", () => {
  it("no hace match con ningun sub-router y cae en el 404 por defecto de Express", async () => {
    // Ninguno de los sub-routers (users/products/orders/notifications, ver
    // src/routes/index.ts) coincide con este path, por lo que no se
    // intenta ninguna llamada de red hacia otro microservicio.
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
  });
});
