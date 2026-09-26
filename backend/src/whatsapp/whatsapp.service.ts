import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WhatsAppReceiptInput = {
  customerName: string;
  phone: string;
  amountPaid: number;
  remaining: number;
  principal: number;
  receiptNumber: string;
  completed?: boolean;
};

export type WhatsAppSendResult = {
  digits: string | null;
  deepLink: string | null;
  message: string;
  sent: boolean;
  error?: string;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: ConfigService) {}

  /** Normalize to international digits (default UAE 971). */
  toDigits(phone: string, defaultCountry = '971'): string | null {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0') && d.length >= 9) {
      d = defaultCountry + d.slice(1);
    } else if (d.length === 9 && d.startsWith('5')) {
      d = defaultCountry + d;
    }
    if (d.length < 10 || d.length > 15) return null;
    return d;
  }

  buildReceiptMessage(input: WhatsAppReceiptInput): string {
    const paid = input.amountPaid.toFixed(2);
    const remaining = input.remaining.toFixed(2);
    const principal = input.principal.toFixed(2);
    const lines = [
      'CrickHerose — collection receipt',
      `Receipt: ${input.receiptNumber}`,
      `Dear ${input.customerName},`,
      `Amount paid: AED ${paid}`,
      `Remaining balance: AED ${remaining} of AED ${principal}`,
    ];
    if (input.completed || input.remaining <= 0) {
      lines.push('Target completed. Thank you!');
    } else {
      lines.push('Thank you for your payment.');
    }
    return lines.join('\n');
  }

  deepLink(digits: string, message: string): string {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  async sendCollectionReceipt(
    input: WhatsAppReceiptInput,
  ): Promise<WhatsAppSendResult> {
    const message = this.buildReceiptMessage(input);
    const defaultCc =
      this.config.get<string>('WHATSAPP_DEFAULT_COUNTRY') || '971';
    const digits = this.toDigits(input.phone, defaultCc);
    if (!digits) {
      return {
        digits: null,
        deepLink: null,
        message,
        sent: false,
        error: 'Customer phone number is missing or invalid',
      };
    }

    const deepLink = this.deepLink(digits, message);
    const token = this.config.get<string>('WHATSAPP_TOKEN')?.trim();
    const phoneNumberId = this.config
      .get<string>('WHATSAPP_PHONE_NUMBER_ID')
      ?.trim();

    if (!token || !phoneNumberId) {
      this.logger.warn(
        'WhatsApp Cloud API not configured — receipt deep link only',
      );
      return { digits, deepLink, message, sent: false };
    }

    try {
      const apiVersion =
        this.config.get<string>('WHATSAPP_API_VERSION') || 'v21.0';
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      const template = this.config.get<string>('WHATSAPP_TEMPLATE_NAME')?.trim();

      const body = template
        ? {
            messaging_product: 'whatsapp',
            to: digits,
            type: 'template',
            template: {
              name: template,
              language: {
                code:
                  this.config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'en',
              },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: input.customerName },
                    { type: 'text', text: input.receiptNumber },
                    { type: 'text', text: input.amountPaid.toFixed(2) },
                    { type: 'text', text: input.remaining.toFixed(2) },
                    { type: 'text', text: input.principal.toFixed(2) },
                  ],
                },
              ],
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: digits,
            type: 'text',
            text: { preview_url: false, body: message },
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`WhatsApp API ${res.status}: ${errText}`);
        return {
          digits,
          deepLink,
          message,
          sent: false,
          error: `WhatsApp API error ${res.status}`,
        };
      }

      return { digits, deepLink, message, sent: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WhatsApp send failed';
      this.logger.error(msg);
      return { digits, deepLink, message, sent: false, error: msg };
    }
  }
}
