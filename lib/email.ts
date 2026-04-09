import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: "mail.smtp2go.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

const FROM = "Masters Pool <noreply@mymasterspool.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://mymasterspool.com";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${BASE_URL}/verify?token=${token}`;

  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your Masters Pool account",
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f5f0e8;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #006747; font-size: 24px; margin: 0;">Masters Pool</h1>
        </div>
        <div style="background: white; border-radius: 12px; padding: 32px; text-align: center;">
          <h2 style="color: #006747; font-size: 20px; margin: 0 0 12px;">Verify Your Email</h2>
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Click the button below to verify your email and activate your chairman account.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #006747; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Verify Email
          </a>
          <p style="color: #aaa; font-size: 11px; margin-top: 24px;">
            Or copy this link: ${verifyUrl}
          </p>
        </div>
      </div>
    `,
  });

  return result;
}
