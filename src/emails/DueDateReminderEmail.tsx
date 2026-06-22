// src/emails/DueDateReminderEmail.tsx
// Due-date reminder template — 3-day and same-day variants
// Props use pre-formatted strings; never pass Date objects (UTC epoch math is the caller's responsibility)

import { Html, Head, Body, Container, Text, Preview } from "@react-email/components";
import * as React from "react";

interface DueDateReminderEmailProps {
  memberName: string;
  bookTitle: string;
  /** Pre-formatted UTC date string, e.g. "2026-06-25" */
  dueDate: string;
  /** 0 = due today; >0 = due in N days */
  daysUntilDue: number;
}

export function DueDateReminderEmail({
  memberName,
  bookTitle,
  dueDate,
  daysUntilDue,
}: DueDateReminderEmailProps) {
  const dueSoon = daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;

  return (
    <Html>
      <Head />
      <Preview>
        Your library book is due {dueSoon}
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9f9f9", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a" }}>
            Library Due Date Reminder
          </Text>
          <Text style={{ color: "#333" }}>
            Hi {memberName},
          </Text>
          <Text style={{ color: "#333" }}>
            Your copy of <strong>{bookTitle}</strong> is due {dueSoon} ({dueDate}).
          </Text>
          {daysUntilDue === 0 ? (
            <Text style={{ color: "#c0392b", fontWeight: "bold" }}>
              Please return it to the library today to avoid fines.
            </Text>
          ) : (
            <Text style={{ color: "#333" }}>
              Please return it to the library on or before the due date to avoid late fines.
            </Text>
          )}
          <Text style={{ color: "#666", fontSize: "13px", marginTop: "24px" }}>
            This is an automated reminder from the Library Management System.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
