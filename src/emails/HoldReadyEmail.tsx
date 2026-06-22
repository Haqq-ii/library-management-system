// src/emails/HoldReadyEmail.tsx
// Hold-ready pickup notification — sent once when a reserved copy becomes available (NOTF-03)
// Props use pre-formatted primitives; never pass Date objects

import { Html, Head, Body, Container, Text, Preview } from "@react-email/components";
import * as React from "react";

interface HoldReadyEmailProps {
  memberName: string;
  bookTitle: string;
  /** Number of hours the member has to pick up the reserved copy before the hold expires */
  pickupWindowHours: number;
}

export function HoldReadyEmail({
  memberName,
  bookTitle,
  pickupWindowHours,
}: HoldReadyEmailProps) {
  const windowText =
    pickupWindowHours === 24
      ? "24 hours"
      : pickupWindowHours === 48
      ? "48 hours"
      : `${pickupWindowHours} hours`;

  return (
    <Html>
      <Head />
      <Preview>
        Your reserved copy of {bookTitle} is ready for pickup
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9f9f9", margin: "0", padding: "0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", color: "#27ae60" }}>
            Your Hold is Ready!
          </Text>
          <Text style={{ color: "#333" }}>
            Hi {memberName},
          </Text>
          <Text style={{ color: "#333" }}>
            Great news! Your reserved copy of <strong>{bookTitle}</strong> is now available for
            pickup at the library.
          </Text>
          <Text style={{ color: "#333" }}>
            Please collect your book within the next{" "}
            <strong>{windowText}</strong>. If the book is not collected within the pickup window,
            your hold may be cancelled and the copy released to the next person in the queue.
          </Text>
          <Text style={{ color: "#333" }}>
            Please bring your library card when you come to collect the book.
          </Text>
          <Text style={{ color: "#666", fontSize: "13px", marginTop: "24px" }}>
            This is an automated hold notification from the Library Management System.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
