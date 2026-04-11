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

const FROM = "TourneyPools <noreply@tourneypools.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${BASE_URL}/verify?token=${token}`;

  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your TourneyPools account",
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f7f5f2;">
        <!-- Hero banner -->
        <div style="border-radius: 12px 12px 0 0; overflow: hidden;">
          <img src="${BASE_URL}/OGImage.jpeg" alt="TourneyPools" style="display: block; width: 100%; height: auto;" />
        </div>

        <!-- Content card -->
        <div style="background: #ffffff; padding: 36px 32px 32px; text-align: center;">
          <h1 style="color: #1a365d; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Verify Your Email</h1>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
            Click the button below to activate your account and start creating golf pools.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #1a365d; color: #ffffff; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
            Verify Email
          </a>
          <p style="color: #b0b0b0; font-size: 11px; margin-top: 28px; line-height: 1.5;">
            Or copy this link:<br />
            <a href="${verifyUrl}" style="color: #2a5298; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 32px 24px; text-align: center;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} TourneyPools &middot; Golf pools for every tournament
          </p>
        </div>
      </div>
    `,
  });

  return result;
}
