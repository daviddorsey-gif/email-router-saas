// libs/email/render.ts
export function withUnsubscribeFooter(htmlBody: string, toEmail: string) {
  const show = process.env.LIST_UNSUB_FOOTER === 'true';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  if (!show || !baseUrl) return htmlBody;

  const footer = `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:12px; color:#6b7280; line-height:1.5; margin:0;">
      You're receiving this because you emailed our support mailbox.
      <a href="${baseUrl}/unsubscribe?email=${encodeURIComponent(toEmail)}" 
         style="text-decoration:underline;">
        Unsubscribe
      </a>
      • 
      <a href="${baseUrl}/unsubscribe/thanks" style="text-decoration:underline;">
        Manage preferences
      </a>
    </p>
  `;
  return `${htmlBody}${footer}`;
}
