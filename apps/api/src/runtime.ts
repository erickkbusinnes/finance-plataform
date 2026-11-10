import { check } from './errors.js';

export const isPreview = () => process.env.DEPLOYMENT_MODE === 'preview';
export const mailEnabled = () => process.env.MAIL_MODE !== 'disabled';
export const requireMail = () =>
  check(mailEnabled(), 503, 'Envio de e-mail indisponível nesta demonstração.');

export function validateRuntime() {
  if (process.env.NODE_ENV !== 'production') return;
  const origin = process.env.APP_ORIGIN;
  let validOrigin = false;
  try {
    const url = new URL(origin || '');
    validOrigin = url.protocol === 'https:' && url.origin === origin;
  } catch {
    // Reject missing origins, credentials, paths, query strings and fragments.
  }
  check(validOrigin, 500, 'APP_ORIGIN deve ser uma origem HTTPS sem caminho ou barra final.');
  if (isPreview()) {
    check(process.env.MAIL_MODE === 'disabled', 500, 'Demonstração exige MAIL_MODE=disabled.');
  } else {
    check(
      process.env.MAIL_MODE === 'smtp' && !!process.env.SMTP_URL && !!process.env.MAIL_FROM,
      500,
      'Configure SMTP e remetente antes de iniciar em produção.',
    );
  }
}
