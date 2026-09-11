import request from "supertest";
import app from "../src/app";
import { getUsers } from "../src/services/users.service";

describe("users.service", () => {
  it("getUsers devuelve una lista no vacia con la forma esperada", () => {
    const users = getUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(typeof user.id).toBe("number");
      expect(typeof user.name).toBe("string");
      expect(user.email).toMatch(/@/);
    }
  });

  it("cada usuario tiene un id unico", () => {
    const ids = getUsers().map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("GET /health", () => {
  it("responde 200 con el nombre del servicio", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "ms-users" });
  });
});
