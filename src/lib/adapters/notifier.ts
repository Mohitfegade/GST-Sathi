import { randomUUID } from 'node:crypto';

export type AlertSeverity = 'info' | 'warn' | 'urgent';

export interface AlertInput {
  firm_id: string;
  client_id?: string;
  title: string;
  body: string;
  severity: AlertSeverity;
}

export interface SendAlertResult {
  sent: boolean;
  id: string;
}

export interface StoredAlertRecord extends AlertInput {
  id: string;
  created_at: Date;
}

export interface NotifierAdapter {
  sendAlert(alert: {
    firm_id: string;
    client_id?: string;
    title: string;
    body: string;
    severity: 'info' | 'warn' | 'urgent';
  }): Promise<{ sent: boolean; id: string }>;
}

export class InMemoryNotifierAdapter implements NotifierAdapter {
  private readonly alerts: StoredAlertRecord[] = [];

  async sendAlert(alert: {
    firm_id: string;
    client_id?: string;
    title: string;
    body: string;
    severity: 'info' | 'warn' | 'urgent';
  }): Promise<{ sent: boolean; id: string }> {
    const id = randomUUID();
    const stored: StoredAlertRecord = {
      firm_id: alert.firm_id,
      client_id: alert.client_id,
      title: alert.title,
      body: alert.body,
      severity: alert.severity,
      id,
      created_at: new Date(),
    };

    this.alerts.push(stored);

    return {
      sent: true,
      id,
    };
  }

  getAlerts(filters?: {
    firm_id?: string;
    client_id?: string;
    severity?: AlertSeverity;
  }): StoredAlertRecord[] {
    return this.alerts.filter((a) => {
      if (filters?.firm_id && a.firm_id !== filters.firm_id) return false;
      if (filters?.client_id && a.client_id !== filters.client_id) return false;
      if (filters?.severity && a.severity !== filters.severity) return false;
      return true;
    });
  }

  getAlertById(id: string): StoredAlertRecord | undefined {
    return this.alerts.find((a) => a.id === id);
  }

  clear(): void {
    this.alerts.length = 0;
  }
}
