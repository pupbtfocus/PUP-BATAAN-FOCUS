import nodemailer from "nodemailer";

type SendInviteOpts = {
  to: string;
  link: string;
  fullName: string;
  from?: string;
};

export async function sendInviteEmail({
  to,
  link,
  fullName,
  from,
}: SendInviteOpts) {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "SMTP configuration missing (EMAIL_SMTP_HOST/PORT/USER/PASS)",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  const fromAddress =
    from || process.env.EMAIL_FROM || "pupbataanfocus.superadmin@gmail.com";

  const subject = "PUP FOCUS — Admin invitation";
  const text = `Hello ${fullName},\n\nYou have been invited to be an admin for PUP FOCUS. Click the link to accept the invitation:\n\n${link}\n\nIf you did not expect this, ignore this message.`;

  const html = `<p>Hello ${fullName},</p>
  <p>You have been invited to be an <strong>admin</strong> for PUP FOCUS.</p>
  <p><a href="${link}">Click here to accept the invitation</a></p>
  <p>If you did not expect this, ignore this message.</p>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  return info;
}
