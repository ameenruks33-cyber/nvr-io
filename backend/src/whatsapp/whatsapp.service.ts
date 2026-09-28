import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';

export type WhatsAppReceiptInput = {
  customerName: string;
  phone: string;
  amountPaid: number;
  remaining: number;
  principal: number;
  /** Total collected so far (after this payment). */
  totalCollected?: number;
  receiptNumber: string;
  collectedAt?: Date | string;
  completed?: boolean;
};

export type WhatsAppSendResult = {
  digits: string | null;
  deepLink: string | null;
  message: string;
  sent: boolean;
  configured: boolean;
  provider?: string;
  error?: string;
};

type ResolvedConfig = {
  configured: boolean;
  enabled: boolean;
  provider: 'green-api' | 'meta' | null;
  instanceId: string | null;
  token: string | null;
  apiUrl: string | null;
  templateName: string | null;
  templateLang: string;
  source: 'settings' | 'env' | 'none';
};

const SETTINGS_ID = 'default';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly audit: AuditService,
  ) {}

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
    const paid = Number(input.amountPaid).toFixed(2);
    const remaining = Number(input.remaining).toFixed(2);
    const total = Number(input.principal).toFixed(2);
    const when = input.collectedAt
      ? new Date(input.collectedAt)
      : new Date();
    const dateTime = Number.isNaN(when.getTime())
      ? new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      : when.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

    const lines = [
      'CrickHerose — Collection Receipt',
      `Receipt: ${input.receiptNumber}`,
      `Date & Time: ${dateTime}`,
      '',
      `Name: ${input.customerName}`,
      `Amount Paid (Cash): AED ${paid}`,
      `Balance Amount (Cash): AED ${remaining}`,
      `Total Amount (Cash): AED ${total}`,
      '',
    ];
    if (input.completed || Number(input.remaining) <= 0) {
      lines.push('Status: Target completed. Thank you!');
    } else {
      lines.push('Thank you for your payment.');
    }
    return lines.join('\n');
  }

  deepLink(digits: string, message: string): string {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  async getPublicStatus() {
    const cfg = await this.resolveConfig();
    return {
      enabled: cfg.enabled,
      configured: cfg.configured,
      provider: cfg.provider,
      source: cfg.source,
      instanceIdSet: Boolean(cfg.instanceId),
      tokenSet: Boolean(cfg.token),
      templateName: cfg.templateName,
      autoSend: cfg.configured && cfg.enabled,
    };
  }

  async getAdminStatus() {
    const row = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
    });
    const cfg = await this.resolveConfig();
    return {
      ...cfg,
      autoSend: cfg.configured && cfg.enabled,
      settings: {
        enabled: row?.whatsappEnabled ?? false,
        provider: row?.whatsappProvider || 'green-api',
        instanceId: row?.whatsappInstanceId || '',
        tokenSet: Boolean(row?.whatsappTokenEncrypted),
        apiUrl: row?.whatsappApiUrl || '',
        templateName: row?.whatsappTemplateName || '',
        templateLang: row?.whatsappTemplateLang || 'en',
      },
    };
  }

  async saveSettings(
    input: {
      enabled: boolean;
      provider: 'green-api' | 'meta';
      instanceId: string;
      token?: string;
      apiUrl?: string;
      templateName?: string;
      templateLang?: string;
    },
    actor: AuthUser,
  ) {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can configure WhatsApp');
    }

    const provider = input.provider === 'meta' ? 'meta' : 'green-api';
    const instanceId = input.instanceId.trim();
    const existing = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
    });

    let tokenEncrypted = existing?.whatsappTokenEncrypted || null;
    if (input.token?.trim()) {
      tokenEncrypted = this.crypto.encrypt(input.token.trim());
    }

    if (input.enabled && (!instanceId || !tokenEncrypted)) {
      throw new BadRequestException(
        'Instance ID and API token are required to enable auto-send',
      );
    }

    await this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        whatsappEnabled: input.enabled,
        whatsappProvider: provider,
        whatsappInstanceId: instanceId || null,
        whatsappTokenEncrypted: tokenEncrypted,
        whatsappApiUrl: input.apiUrl?.trim() || null,
        whatsappTemplateName: input.templateName?.trim() || null,
        whatsappTemplateLang: input.templateLang?.trim() || 'en',
      },
      update: {
        whatsappEnabled: input.enabled,
        whatsappProvider: provider,
        whatsappInstanceId: instanceId || null,
        whatsappTokenEncrypted: tokenEncrypted,
        whatsappApiUrl: input.apiUrl?.trim() || null,
        whatsappTemplateName: input.templateName?.trim() || null,
        whatsappTemplateLang: input.templateLang?.trim() || 'en',
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'WHATSAPP_SETTINGS_UPDATE',
      recordType: 'app_settings',
      recordId: SETTINGS_ID,
      metadata: { enabled: input.enabled, provider },
    });

    return this.getAdminStatus();
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
        configured: false,
        error: 'Customer phone number is missing or invalid',
      };
    }

    const deepLink = this.deepLink(digits, message);
    const cfg = await this.resolveConfig();

    // Always try API when credentials exist (env or Settings)
    if (cfg.configured && cfg.enabled) {
      const apiResult =
        cfg.provider === 'green-api'
          ? await this.sendViaGreenApi(cfg, digits, message, deepLink)
          : await this.sendViaMeta(cfg, digits, message, deepLink, input);
      if (apiResult.sent) return apiResult;
      // Keep deep link so collector can still deliver the same receipt
      return { ...apiResult, deepLink, message };
    }

    this.logger.warn(
      'WhatsApp API not configured — returning customer deep link',
    );
    return {
      digits,
      deepLink,
      message,
      sent: false,
      configured: false,
      error: undefined,
    };
  }

  private async resolveConfig(): Promise<ResolvedConfig> {
    const row = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (row?.whatsappEnabled && row.whatsappTokenEncrypted && row.whatsappInstanceId) {
      let token: string | null = null;
      try {
        token = this.crypto.decrypt(row.whatsappTokenEncrypted);
      } catch (e) {
        this.logger.error(
          `Failed to decrypt WhatsApp token: ${e instanceof Error ? e.message : e}`,
        );
      }
      if (token) {
        const provider =
          row.whatsappProvider === 'meta' ? 'meta' : 'green-api';
        return {
          configured: true,
          enabled: true,
          provider,
          instanceId: row.whatsappInstanceId,
          token,
          apiUrl: row.whatsappApiUrl || null,
          templateName: row.whatsappTemplateName || null,
          templateLang: row.whatsappTemplateLang || 'en',
          source: 'settings',
        };
      }
    }

    const envToken = this.config.get<string>('WHATSAPP_TOKEN')?.trim();
    const greenInstance = this.config
      .get<string>('WHATSAPP_GREEN_ID_INSTANCE')
      ?.trim();
    const metaPhoneId = this.config
      .get<string>('WHATSAPP_PHONE_NUMBER_ID')
      ?.trim();
    const envProviderRaw = (
      this.config.get<string>('WHATSAPP_PROVIDER') || ''
    ).toLowerCase();

    let envProvider: 'green-api' | 'meta' | null = null;
    let envInstance: string | null = null;
    if (envToken && greenInstance && (envProviderRaw === 'green-api' || !metaPhoneId)) {
      envProvider = 'green-api';
      envInstance = greenInstance;
    } else if (envToken && metaPhoneId) {
      envProvider = 'meta';
      envInstance = metaPhoneId;
    } else if (envToken && greenInstance) {
      envProvider = 'green-api';
      envInstance = greenInstance;
    }

    if (envToken && envInstance && envProvider) {
      return {
        configured: true,
        enabled: true,
        provider: envProvider,
        instanceId: envInstance,
        token: envToken,
        apiUrl:
          this.config.get<string>('WHATSAPP_GREEN_API_URL')?.trim() ||
          this.config.get<string>('WHATSAPP_API_URL')?.trim() ||
          null,
        templateName:
          this.config.get<string>('WHATSAPP_TEMPLATE_NAME')?.trim() || null,
        templateLang:
          this.config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'en',
        source: 'env',
      };
    }

    return {
      configured: false,
      enabled: false,
      provider: null,
      instanceId: null,
      token: null,
      apiUrl: null,
      templateName: null,
      templateLang: 'en',
      source: 'none',
    };
  }

  private async sendViaGreenApi(
    cfg: ResolvedConfig,
    digits: string,
    message: string,
    deepLink: string,
  ): Promise<WhatsAppSendResult> {
    const base = (cfg.apiUrl || 'https://api.green-api.com').replace(/\/$/, '');
    const url = `${base}/waInstance${cfg.instanceId}/sendMessage/${cfg.token}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${digits}@c.us`,
          message,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Green API ${res.status}: ${errText}`);
        return {
          digits,
          deepLink,
          message,
          sent: false,
          configured: true,
          provider: 'green-api',
          error: `WhatsApp send failed (${res.status})`,
        };
      }
      return {
        digits,
        deepLink,
        message,
        sent: true,
        configured: true,
        provider: 'green-api',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WhatsApp send failed';
      this.logger.error(msg);
      return {
        digits,
        deepLink,
        message,
        sent: false,
        configured: true,
        provider: 'green-api',
        error: msg,
      };
    }
  }

  private async sendViaMeta(
    cfg: ResolvedConfig,
    digits: string,
    message: string,
    deepLink: string,
    input: WhatsAppReceiptInput,
  ): Promise<WhatsAppSendResult> {
    try {
      const apiVersion =
        this.config.get<string>('WHATSAPP_API_VERSION') || 'v21.0';
      const url = `https://graph.facebook.com/${apiVersion}/${cfg.instanceId}/messages`;
      const template = cfg.templateName?.trim();

      const body = template
        ? {
            messaging_product: 'whatsapp',
            to: digits,
            type: 'template',
            template: {
              name: template,
              language: { code: cfg.templateLang || 'en' },
              components: [
                {
                  type: 'body',
                  // Template body order: {{1}} Name, {{2}} Amount Paid, {{3}} Balance, {{4}} Total
                  parameters: [
                    { type: 'text', text: input.customerName },
                    { type: 'text', text: Number(input.amountPaid).toFixed(2) },
                    { type: 'text', text: Number(input.remaining).toFixed(2) },
                    { type: 'text', text: Number(input.principal).toFixed(2) },
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
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`WhatsApp Meta API ${res.status}: ${errText}`);
        return {
          digits,
          deepLink,
          message,
          sent: false,
          configured: true,
          provider: 'meta',
          error: `WhatsApp API error ${res.status}`,
        };
      }

      return {
        digits,
        deepLink,
        message,
        sent: true,
        configured: true,
        provider: 'meta',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WhatsApp send failed';
      this.logger.error(msg);
      return {
        digits,
        deepLink,
        message,
        sent: false,
        configured: true,
        provider: 'meta',
        error: msg,
      };
    }
  }
}
