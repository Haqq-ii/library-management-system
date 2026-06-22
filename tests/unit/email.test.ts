import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the resend module before imports
vi.mock("resend", () => {
  const sendMock = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: sendMock,
      },
    })),
    __sendMock: sendMock,
  };
});

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  prisma: {
    notificationLog: {
      create: vi.fn(),
    },
  },
}));

import { sendAndLog } from "@/lib/email";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import * as React from "react";

// Access the mocked send function through the Resend instance
function getResendSendMock() {
  // Get the send mock from the first instantiated Resend client
  const MockedResend = vi.mocked(Resend);
  const instance = MockedResend.mock.results[0]?.value as { emails: { send: ReturnType<typeof vi.fn> } } | undefined;
  return instance?.emails.send;
}

const notificationLogCreate = vi.mocked(prisma.notificationLog.create);

describe("sendAndLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset notificationLog mock to return something
    notificationLogCreate.mockResolvedValue({} as never);
  });

  const baseOpts = {
    to: "member@example.com",
    subject: "Test Subject",
    react: React.createElement("div", null, "Test email"),
    memberId: "member-123",
    type: "DUE_DATE_3DAY" as const,
    idempotencyKey: "DUE_DATE_3DAY/loan-abc/2026-06-22",
  };

  it("Test 1 (NOTF-04 success): resolves success:true and writes NotificationLog with success:true when Resend returns data", async () => {
    const sendMock = getResendSendMock();
    sendMock?.mockResolvedValue({ data: { id: "email-xyz" }, error: null });

    const result = await sendAndLog(baseOpts);

    expect(result).toEqual({ success: true });
    expect(notificationLogCreate).toHaveBeenCalledOnce();
    expect(notificationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-123",
          type: "DUE_DATE_3DAY",
          channel: "EMAIL",
          success: true,
        }),
      })
    );
  });

  it("Test 2 (NOTF-04 failure): resolves success:false and writes NotificationLog with success:false when Resend returns error", async () => {
    const sendMock = getResendSendMock();
    sendMock?.mockResolvedValue({ data: null, error: { name: "rate_limited" } });

    const result = await sendAndLog(baseOpts);

    expect(result).toEqual({ success: false });
    expect(notificationLogCreate).toHaveBeenCalledOnce();
    expect(notificationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: false,
        }),
      })
    );
  });

  it("Test 3 (NOTF-04 throw path): does not rethrow when Resend send throws, still calls notificationLog.create with success:false", async () => {
    const sendMock = getResendSendMock();
    sendMock?.mockRejectedValue(new Error("Network error"));

    const result = await sendAndLog(baseOpts);

    expect(result).toEqual({ success: false });
    expect(notificationLogCreate).toHaveBeenCalledOnce();
    expect(notificationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          success: false,
        }),
      })
    );
  });

  it("Test 4 (idempotency wiring): idempotencyKey is forwarded as second argument to resend.emails.send", async () => {
    const sendMock = getResendSendMock();
    sendMock?.mockResolvedValue({ data: { id: "email-abc" }, error: null });

    await sendAndLog({ ...baseOpts, idempotencyKey: "OVERDUE_ALERT/loan-999/2026-06-22" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["member@example.com"],
        subject: "Test Subject",
      }),
      expect.objectContaining({
        idempotencyKey: "OVERDUE_ALERT/loan-999/2026-06-22",
      })
    );
  });
});
