// src/emails/OverdueAlertEmail.tsx
// Overdue alert template — sent daily while a loan is overdue (NOTF-02)
// Props use pre-formatted primitives; never pass Date objects

import { Html, Head, Body, Container, Text, Preview } from "@react-email/components";
import * as React from "react";

interface OverdueAlertEmailProps {
  memberName: string;
  bookTitle: string;
  /** Number of days the book is overdue (optional — shown if provided) */
  daysOverdue?: number;
}

export function OverdueAlertEmail({
  memberName,
  bookTitle,
  daysOverdue,
}: OverdueAlertEmailProps) {
  const overdueText =
    daysOverdue !== undefined && daysOverdue > 0
      ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`
      : "overdue";

  return (
    <Html>
      <Head />
      <Preview>
        Overdue notice: {bookTitle} is {overdueText} — please return it
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9f9f9", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#c0392b" }}>
            Overdue Book Notice
          </Text>
          <Text style={{ color: "#333" }}>
            Hi {memberName},
          </Text>
          <Text style={{ color: "#333" }}>
            Your copy of <strong>{bookTitle}</strong> is currently{" "}
            <strong style={{ color: "#c0392b" }}>{overdueText}</strong>.
          </Text>
          <Text style={{ color: "#333" }}>
            Late fines are accruing daily. Please return the book to the library as soon as
            possible to stop the fine from increasing.
          </Text>
          <Text style={{ color: "#333" }}>
            If you have already returned this book, please contact the library to ensure the
            return has been recorded.
          </Text>
          <Text style={{ color: "#666", fontSize: "13px", marginTop: "24px" }}>
            This is an automated overdue alert from the Library Management System.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
