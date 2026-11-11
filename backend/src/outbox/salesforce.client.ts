import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Salesforce REST client (OAuth client-credentials, upsert by external ID).
 * REQUIRES: a Connected App with the client-credentials flow and a custom object (default Web_Order__c)
 * with External_Id__c (External ID, unique). See docs/salesforce.md. Nothing is assumed to exist.
 */
@Injectable()
export class SalesforceClient {
  private readonly log = new Logger(SalesforceClient.name);
  private token?: { value: string; instanceUrl: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return !!(this.config.get('SALESFORCE_CLIENT_ID') && this.config.get('SALESFORCE_CLIENT_SECRET'));
  }

  private async auth() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token;
    const res = await fetch(`${this.config.get('SALESFORCE_LOGIN_URL')}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.get<string>('SALESFORCE_CLIENT_ID')!,
        client_secret: this.config.get<string>('SALESFORCE_CLIENT_SECRET')!,
      }),
    });
    if (!res.ok) throw new Error(`Salesforce auth failed: ${res.status}`);
    const j = (await res.json()) as { access_token: string; instance_url: string };
    this.token = { value: j.access_token, instanceUrl: j.instance_url, expiresAt: Date.now() + 25 * 60_000 };
    return this.token;
  }

  async sync(aggregateType: string, aggregateId: string, eventType: string, payload: Record<string, unknown>) {
    if (aggregateType !== 'ORDER') return; // other aggregates are added in later phases
    const t = await this.auth();
    const object = this.config.get('SALESFORCE_ORDER_OBJECT') ?? 'Web_Order__c';
    const body = {
      Order_Number__c: payload.orderNumber,
      Status__c: payload.status,
      Payment_Status__c: payload.paymentStatus,
      Fulfilment__c: payload.fulfilment,
      Total_Amount__c: Number(payload.totalPaise) / 100,
      Customer_Phone__c: payload.customerPhone,
      Customer_Name__c: payload.customerName,
      Last_Event__c: eventType,
    };
    // Upsert by external ID: idempotent and safe to retry.
    const res = await fetch(`${t.instanceUrl}/services/data/v60.0/sobjects/${object}/External_Id__c/${aggregateId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${t.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) this.token = undefined;
    if (!res.ok) throw new Error(`Salesforce upsert failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    this.log.debug(`Synced ${eventType} for ${aggregateId}`);
  }
}
