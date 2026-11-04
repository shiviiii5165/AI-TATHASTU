// Real sends through the installed nodemailer, to a minimal SMTP server on this machine.
import net from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requiresStartTls, sendEmail } from "./email";

const received: string[] = [];
let server: net.Server;

beforeAll(async () => {
  server = net.createServer((socket) => {
    let inData = false;
    socket.write("220 test ESMTP\r\n");
    socket.on("data", (chunk) => {
      for (const line of chunk.toString().split("\r\n").filter(Boolean)) {
        received.push(line);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 queued\r\n");
          }
        } else if (/^EHLO/i.test(line)) socket.write("250-test\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH/i.test(line)) socket.write("235 ok\r\n");
        else if (/^DATA/i.test(line)) {
          inData = true;
          socket.write("354 go\r\n");
        } else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
    socket.on("error", () => {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_INFO_USER: "sender@example.com", SMTP_INFO_PASSWORD: "test-only" });
});

afterAll(() => {
  server.close();
});

describe("sendEmail", () => {
  it("delivers through the installed nodemailer", async () => {
    const info = await sendEmail({ profile: "system", to: "person@example.com", email: { subject: "Hello", html: "<p>Hi</p>", text: "Hi" } });
    expect(info.accepted).toEqual(["person@example.com"]);
    expect(received.some((line) => line.includes("person@example.com"))).toBe(true);
    expect(received).toContain("Subject: Hello");
  });

  it("can't be talked into extra recipients by a crafted address", async () => {
    received.length = 0;
    await sendEmail({ profile: "system", to: '"a@evil.example; b@evil.example" <person@example.com>', email: { subject: "x", html: "x", text: "x" } }).catch(() => {});
    expect(received.filter((line) => /^RCPT/i.test(line) && line.includes("evil.example"))).toEqual([]);
  });
});

describe("requiresStartTls", () => {
  it("requires TLS for any remote server not already on implicit TLS", () => {
    expect(requiresStartTls("smtp.example.com", 587)).toBe(true);
    expect(requiresStartTls("smtp.example.com", 25)).toBe(true);
    expect(requiresStartTls(undefined, 587)).toBe(true);
  });

  it("leaves implicit TLS and a local test server alone", () => {
    expect(requiresStartTls("smtp.example.com", 465)).toBe(false);
    expect(requiresStartTls("127.0.0.1", 2525)).toBe(false);
  });
});
