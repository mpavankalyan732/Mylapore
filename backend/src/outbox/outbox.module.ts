import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { SalesforceClient } from './salesforce.client';

@Module({ providers: [OutboxService, SalesforceClient], exports: [OutboxService] })
export class OutboxModule {}
