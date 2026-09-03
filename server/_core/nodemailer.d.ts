declare module "nodemailer" {
  export type SendMailOptions = {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
  };
  export type Transporter = {
    sendMail(options: SendMailOptions): Promise<{ messageId?: string }>;
    verify(): Promise<true>;
  };
  export function createTransport(options: unknown): Transporter;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
