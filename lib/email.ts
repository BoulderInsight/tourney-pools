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
  const setPasswordUrl = `${BASE_URL}/set-password?token=${token}&new=1`;

  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Set up your TourneyPools account",
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f7f5f2;">
        <!-- Hero banner -->
        <div style="border-radius: 12px 12px 0 0; overflow: hidden;">
          <img src="${BASE_URL}/OGImage.jpeg" alt="TourneyPools" style="display: block; width: 100%; height: auto;" />
        </div>

        <!-- Content card -->
        <div style="background: #ffffff; padding: 36px 32px 32px; text-align: center;">
          <h1 style="color: #1a365d; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Welcome to TourneyPools!</h1>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
            Click the button below to set your password and activate your account.
          </p>
          <a href="${setPasswordUrl}" style="display: inline-block; background: #1a365d; color: #ffffff; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
            Set Your Password
          </a>
          <p style="color: #b0b0b0; font-size: 11px; margin-top: 28px; line-height: 1.5;">
            Or copy this link:<br />
            <a href="${setPasswordUrl}" style="color: #2a5298; word-break: break-all;">${setPasswordUrl}</a>
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

export async function sendResetPasswordEmail(email: string, token: string) {
  const resetUrl = `${BASE_URL}/set-password?token=${token}`;

  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your TourneyPools password",
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f7f5f2;">
        <div style="border-radius: 12px 12px 0 0; overflow: hidden;">
          <img src="${BASE_URL}/OGImage.jpeg" alt="TourneyPools" style="display: block; width: 100%; height: auto;" />
        </div>
        <div style="background: #ffffff; padding: 36px 32px 32px; text-align: center;">
          <h1 style="color: #1a365d; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Reset Your Password</h1>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 28px;">
            Click the button below to set a new password for your account.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #1a365d; color: #ffffff; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.3px;">
            Set New Password
          </a>
          <p style="color: #b0b0b0; font-size: 11px; margin-top: 28px; line-height: 1.5;">
            If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </div>
        <div style="padding: 16px 32px 24px; text-align: center;">
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} TourneyPools
          </p>
        </div>
      </div>
    `,
  });

  return result;
}

export async function sendFeedbackEmail(fromName: string, fromEmail: string, message: string) {
  const transporter = getTransporter();

  const result = await transporter.sendMail({
    from: FROM,
    to: "chris@boulderinsight.com",
    replyTo: fromEmail,
    subject: `TourneyPools Feedback from ${fromName}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f7f5f2;">
        <div style="background: #1a365d; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">New Feedback</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">From</p>
          <p style="color: #1a365d; font-size: 15px; font-weight: 600; margin: 0 0 20px;">${fromName} &lt;${fromEmail}&gt;</p>
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">Message</p>
          <div style="background: #f7f5f2; border-radius: 8px; padding: 16px; margin: 0;">
            <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      </div>
    `,
  });

  return result;
}
