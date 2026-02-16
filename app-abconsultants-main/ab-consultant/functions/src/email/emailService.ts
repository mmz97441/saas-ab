import * as nodemailer from 'nodemailer';
import * as functions from 'firebase-functions';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.office365.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      throw new Error(
        'SMTP_USER et SMTP_PASS doivent être configurés dans functions/.env'
      );
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // STARTTLS
      auth: { user, pass },
      tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
    });
  }
  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: SendMailOptions): Promise<boolean> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    functions.logger.error('SMTP_USER/SMTP_FROM non configuré — email non envoyé');
    return false;
  }

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"AB Consultants" <${from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    functions.logger.info('Email envoyé', { to: options.to, subject: options.subject });
    return true;
  } catch (err: any) {
    functions.logger.error('Erreur envoi email', {
      to: options.to,
      error: err?.message,
      code: err?.code,
    });
    return false;
  }
}
