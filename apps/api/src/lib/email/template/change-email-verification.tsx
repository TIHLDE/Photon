import { Button, Html } from "@react-email/components";
import React from "react";

interface ChangeEmailVerificationProps {
  url: string;
}

export const ChangeEmailVerification = ({url} : ChangeEmailVerificationProps) => {
  return (
    <Html>
      <Button
        href={url}
        style={{ background: "#000", color: "#fff", padding: "12px 20px" }}
      >
      Trykk her for å verifisere din nye e-postadresse
      </Button>
    </Html>
  );
}

export default ChangeEmailVerification;