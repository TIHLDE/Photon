import { Button, Html } from "@react-email/components";
import React from "react";

interface OtpSignInProps {
  otp: string;
}

export const OtpSignIn = ({otp} : OtpSignInProps) => {
  return (
    <Html>
      Din engangskode er: {otp}
    </Html>
  );
}

export default OtpSignIn;